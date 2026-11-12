import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { installFakeMedia, uninstallFakeMedia } from '@/test/fake-media';
import { server } from '@/test/msw';
import { demoMe, renderWithProviders } from '@/test/render';
import type * as UploadModule from '@/lib/upload';
import { UploadForm } from './upload-form';

// jsdom cannot decode audio, so the duration reader is stubbed; the XHR upload is real (via MSW).
vi.mock('@/lib/upload', async (original) => ({
  ...(await original<typeof UploadModule>()),
  readDuration: () => Promise.resolve(42),
}));

const R2_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

const mp3 = (bytes = 2048) =>
  new File([new Uint8Array(bytes)], 'ikhlas.mp3', { type: 'audio/mpeg' });

async function fillDetails() {
  // applyAccept: false lets tests pick files the input's accept attribute would hide.
  const user = userEvent.setup({ applyAccept: false });
  await user.selectOptions(screen.getByLabelText('Surah'), '112');
  await user.clear(screen.getByLabelText('To ayah'));
  await user.type(screen.getByLabelText('To ayah'), '4');
  await user.type(screen.getByLabelText('Title'), 'Al-Ikhlas, morning');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  return user;
}

describe('UploadForm', () => {
  it('rejects an ayah range past the end of the surah', async () => {
    renderWithProviders(<UploadForm />, { me: demoMe });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Surah'), '112');
    await user.clear(screen.getByLabelText('To ayah'));
    await user.type(screen.getByLabelText('To ayah'), '9');
    await user.type(screen.getByLabelText('Title'), 'x');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('That ayah range does not exist in this surah.'),
    ).toBeInTheDocument();
  });

  it('refuses unsupported file types before uploading anything', async () => {
    renderWithProviders(<UploadForm />, { me: demoMe });
    const user = await fillDetails();
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['x'], 'clip.mp4', { type: 'video/mp4' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('This file type is not supported.');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('presigns, uploads directly to storage with progress, confirms, and shows "waiting for review"', async () => {
    const calls: string[] = [];
    server.use(
      http.post('*/api/v1/uploads/presign', async ({ request }) => {
        calls.push('presign');
        const body = (await request.json()) as {
          surah: number;
          ayahTo: number;
          rightsConfirmed: boolean;
        };
        expect(body).toMatchObject({ surah: 112, ayahTo: 4, rightsConfirmed: true });
        return HttpResponse.json({
          uploadUrl: 'https://storage.test/incoming/u/1.mp3?sig=x',
          method: 'PUT',
          headers: { 'Content-Type': 'audio/mpeg' },
          uploadToken: 'token-123',
          expiresAt: '2026-11-12T09:00:00.000Z',
        });
      }),
      // Storage is cross-origin, so (like the R2 bucket CORS policy) it must answer the preflight.
      http.options(
        'https://storage.test/incoming/u/1.mp3',
        () => new HttpResponse(null, { status: 204, headers: R2_CORS }),
      ),
      http.put('https://storage.test/incoming/u/1.mp3', ({ request }) => {
        calls.push(`put ${request.headers.get('content-type') ?? ''}`);
        return new HttpResponse(null, { status: 200, headers: R2_CORS });
      }),
      http.post('*/api/v1/recitations', async ({ request }) => {
        calls.push('confirm');
        expect(await request.json()).toMatchObject({
          uploadToken: 'token-123',
          title: 'Al-Ikhlas, morning',
          durationSec: 42,
          riwayah: 'hafs',
        });
        return HttpResponse.json({ id: 'r1', status: 'pending' }, { status: 201 });
      }),
    );
    renderWithProviders(<UploadForm />, { me: demoMe });
    const user = await fillDetails();
    await user.upload(screen.getByLabelText(/Choose a file/), mp3());
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const upload = screen.getByRole('button', { name: 'Upload' });
    expect(upload).toBeDisabled(); // permission not yet confirmed
    await user.click(screen.getByLabelText(/my own recitation/));
    await user.click(upload);
    expect(await screen.findByText('Uploaded. Waiting for review.')).toBeInTheDocument();
    expect(calls).toEqual(['presign', 'put audio/mpeg', 'confirm']);
  });

  it('explains a full storage quota', async () => {
    server.use(
      http.post('*/api/v1/uploads/presign', () =>
        HttpResponse.json(
          { error: { code: 'QUOTA_EXCEEDED', message: 'full', details: {} } },
          { status: 403 },
        ),
      ),
    );
    renderWithProviders(<UploadForm />, { me: demoMe });
    const user = await fillDetails();
    await user.upload(screen.getByLabelText(/Choose a file/), mp3());
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByLabelText(/my own recitation/));
    await user.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Your storage is full'),
    );
  });

  it('uploads a recording made in the browser, using the recorder’s duration', async () => {
    // Only the recorder's clock is faked; setTimeout stays real for Testing Library's polling.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    installFakeMedia();
    let presigned: unknown;
    let confirmed: unknown;
    server.use(
      http.post('*/api/v1/uploads/presign', async ({ request }) => {
        presigned = await request.json();
        return HttpResponse.json({
          uploadUrl: 'https://storage.test/incoming/u/2.webm?sig=x',
          method: 'PUT',
          headers: { 'Content-Type': 'audio/webm' },
          uploadToken: 'token-rec',
          expiresAt: '2026-11-12T09:00:00.000Z',
        });
      }),
      http.options(
        'https://storage.test/incoming/u/2.webm',
        () => new HttpResponse(null, { status: 204, headers: R2_CORS }),
      ),
      http.put(
        'https://storage.test/incoming/u/2.webm',
        () => new HttpResponse(null, { status: 200, headers: R2_CORS }),
      ),
      http.post('*/api/v1/recitations', async ({ request }) => {
        confirmed = await request.json();
        return HttpResponse.json({ id: 'r2', status: 'pending' }, { status: 201 });
      }),
    );
    renderWithProviders(<UploadForm />, { me: demoMe });
    const user = userEvent.setup({ applyAccept: false });
    await user.selectOptions(screen.getByLabelText('Surah'), '112');
    await user.clear(screen.getByLabelText('To ayah'));
    await user.type(screen.getByLabelText('To ayah'), '4');
    await user.type(screen.getByLabelText('Title'), 'Recorded at home');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('radio', { name: 'Record now' }));
    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await act(() => vi.advanceTimersByTimeAsync(6000));
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    await user.click(screen.getByRole('button', { name: 'Use this recording' }));

    await user.click(screen.getByLabelText(/my own recitation/));
    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Uploaded. Waiting for review.')).toBeInTheDocument();
    expect(presigned).toMatchObject({ contentType: 'audio/webm', surah: 112 });
    expect(confirmed).toMatchObject({
      uploadToken: 'token-rec',
      durationSec: 6,
      title: 'Recorded at home',
    });
    uninstallFakeMedia();
    vi.useRealTimers();
  });
});
