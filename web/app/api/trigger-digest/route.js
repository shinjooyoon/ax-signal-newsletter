export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== 'Bearer ' + cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const githubToken = process.env.DIGEST_TRIGGER_TOKEN;
  if (!githubToken) {
    return new Response('Missing DIGEST_TRIGGER_TOKEN', { status: 500 });
  }

  const res = await fetch(
    'https://api.github.com/repos/shinjooyoon/ax-signal-newsletter/actions/workflows/daily-digest.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + githubToken,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return Response.json({ success: false, status: res.status, error: text }, { status: 502 });
  }

  return Response.json({ success: true });
}
