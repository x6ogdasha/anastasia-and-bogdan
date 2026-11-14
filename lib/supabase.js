function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  return { url, serviceRoleKey };
}

export async function supabaseRequest(path, options = {}) {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`SUPABASE_${response.status}`);
    error.detail = detail;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}
