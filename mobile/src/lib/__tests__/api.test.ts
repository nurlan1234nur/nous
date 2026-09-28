jest.mock('../../config/env', () => ({ API_ORIGIN: 'https://api.test' }));
jest.mock('../tokenStorage', () => ({ getToken: jest.fn() }));

import { api, ApiError, assetUrl, setMediaToken, setUnauthorizedHandler } from '../api';
import { getToken } from '../tokenStorage';

const mockedGetToken = getToken as jest.MockedFunction<typeof getToken>;

function mockFetch(status: number, body: unknown) {
  const fn = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  setUnauthorizedHandler(null);
  jest.resetAllMocks();
});

describe('api', () => {
  it('sends the bearer token and parses JSON', async () => {
    mockedGetToken.mockResolvedValue('tok');
    const fetchMock = mockFetch(200, { ok: true });
    await expect(api('/health')).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/health');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('throws ApiError with the server message', async () => {
    mockedGetToken.mockResolvedValue(null);
    mockFetch(400, { error: 'Буруу өгөгдөл' });
    await expect(api('/x')).rejects.toEqual(expect.objectContaining({ message: 'Буруу өгөгдөл', status: 400 }));
  });

  it('calls the unauthorized handler only for authenticated 401s', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    mockedGetToken.mockResolvedValue(null);
    mockFetch(401, { error: 'Нэр эсвэл нууц үг буруу' });
    await expect(api('/auth/login', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();

    mockedGetToken.mockResolvedValue('expired');
    mockFetch(401, { error: 'Token хүчингүй байна' });
    await expect(api('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('maps network failures to a friendly error', async () => {
    mockedGetToken.mockResolvedValue(null);
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(api('/x')).rejects.toEqual(expect.objectContaining({ status: 0 }));
  });
});

describe('assetUrl', () => {
  it('prefixes server-relative paths only', () => {
    expect(assetUrl('/uploads/a.jpg')).toBe('https://api.test/uploads/a.jpg');
    expect(assetUrl('https://res.cloudinary.com/x.jpg')).toBe('https://res.cloudinary.com/x.jpg');
    expect(assetUrl('💛')).toBe('💛');
    expect(assetUrl('')).toBe('');
  });
});

describe('media token', () => {
  afterEach(() => setMediaToken(null));

  it('is appended only to uploaded files', () => {
    setMediaToken('m.t/k+n');
    expect(assetUrl('/uploads/a.jpg')).toBe('https://api.test/uploads/a.jpg?t=m.t%2Fk%2Bn');
    expect(assetUrl('/privacy.html')).toBe('https://api.test/privacy.html');
    expect(assetUrl('https://res.cloudinary.com/x.jpg')).toBe('https://res.cloudinary.com/x.jpg');
  });
});
