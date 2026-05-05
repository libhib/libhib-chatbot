const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
  };

  if (req.method === "GET") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=*&order=created_at.desc`, { headers });    const data = await r.json();
    res.status(200).json(data);

  } else if (req.method === "POST") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.status(200).json(data);
  }
}