import { SELF, fetchMock } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';

const goodUrl = 'https://proxyhostname.example/rotorflight/rotorflight-firmware/releases/download/release/4.5.0-RC4/rotorflight_4.5.0-RC4_STM32F7X2.hex'
const goodOrigin = 'https://rf.6bit.com'

function goodFetch(options = {}, url = goodUrl) {
    return SELF.fetch(url, {
      ...options,
      headers: {
        Origin: goodOrigin,
        ...options.headers || {},
      },
    });
}

beforeAll(() => {
  // Enable outbound request mocking...
  fetchMock.activate();
  // ...and throw errors if an outbound request isn't mocked
  fetchMock.disableNetConnect();
});

describe('Rotorflight asset proxy', () => {
  it('responds with upstream content on happy path', async () => {
    const content = 'firmware file'
    fetchMock
      .get("https://github.com")
      .intercept({ path: "/rotorflight/rotorflight-firmware/releases/download/release/4.5.0-RC4/rotorflight_4.5.0-RC4_STM32F7X2.hex" })
      .reply(200, content);

    const response = await goodFetch()

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(content);
    expect(response.headers.get('cache-control')).toBe('public, max-age=5259488')
    expect(response.headers.get('access-control-allow-origin')).toBe(goodOrigin)
  });

  it('responds with upstream content without slash in release tag', async () => {
    const content = 'firmware file'
    fetchMock
      .get("https://github.com")
      .intercept({ path: "/rotorflight/rotorflight-firmware/releases/download/release-4.5.0-RC4/rotorflight_4.5.0-RC4_STM32F7X2.hex" })
      .reply(200, content);

    const response = await goodFetch({}, goodUrl.replace('release/4.5.0-RC4', 'release-4.5.0-RC4'))

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(content);
  });

  it('proxies HEAD requests', async () => {
    fetchMock
      .get("https://github.com")
      .intercept({ method: 'HEAD', path: "/rotorflight/rotorflight-firmware/releases/download/release/4.5.0-RC4/rotorflight_4.5.0-RC4_STM32F7X2.hex" })
      .reply(200);

    const response = await goodFetch({
      method: 'HEAD',
    })

    expect(response.status).toBe(200);
  });

  it('responds with 403 when no origin header', async () => {
    const response = await SELF.fetch(goodUrl)

    expect(response.status).toBe(403);
  });

  it('responds with 403 when origin not on whitelist', async () => {
    const response = await goodFetch({ headers: {
      Origin: 'https://ddoser.example',
    }})

    expect(response.status).toBe(403);
  });

  it('responds with 404 when not GET method', async () => {
    const response = await goodFetch({
      method: 'POST',
    })

    expect(response.status).toBe(405);
  });

  it('responds with 404 not found for invalid URL path', async () => {
    const response = await goodFetch({}, 'http://proxyhostname.example/404')

    expect(response.status).toBe(404);
  });
});
