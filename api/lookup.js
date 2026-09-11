export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { username } = req.query;

  if (!username || !username.trim()) {
    return res.status(400).json({ success: false, error: 'Username required' });
  }

  const clean = username.trim().replace(/^@/, '');

  try {
    const response = await fetch(`https://www.tiktok.com/@${clean}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0.0; Plume L2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-fetch-site': 'none',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
        'upgrade-insecure-requests': '1',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ success: false, error: `TikTok returned ${response.status}` });
    }

    const html = await response.text();

    const parts = html.split('webapp.user-detail"');
    if (parts.length < 2) {
      return res.status(404).json({ success: false, error: `User not found: @${clean}` });
    }

    const userData = parts[1].split('"RecommendUserList"')[0];

    function between(str, start, end) {
      const s = str.indexOf(start);
      if (s === -1) return '';
      const sub = str.slice(s + start.length);
      const e = sub.indexOf(end);
      if (e === -1) return '';
      return sub.slice(0, e);
    }

    const id        = between(userData, '"id":"', '",');
    const name      = between(userData, '"nickname":"', '",');
    const bio       = between(userData, '"signature":"', '",').replace(/\\n/g, '\n');
    const country   = between(userData, '"region":"', '",');
    const isPrivate = between(userData, '"privateAccount":', ',') === 'true';
    const followers = parseInt(between(userData, '"followerCount":', ',')) || 0;
    const following = parseInt(between(userData, '"followingCount":', ',')) || 0;
    const likes     = parseInt(between(userData, '"heart":', ',')) || 0;
    const videos    = parseInt(between(userData, '"videoCount":', ',')) || 0;
    const secuid    = between(userData, '"secUid":"', '"');
    const avatar    = between(userData, '"avatarLarger":"', '"').replace(/\\u002F/g, '/');

    const countryMap = {
      US:'🇺🇸 United States', GB:'🇬🇧 United Kingdom', BD:'🇧🇩 Bangladesh',
      IN:'🇮🇳 India', CA:'🇨🇦 Canada', AU:'🇦🇺 Australia', BR:'🇧🇷 Brazil',
      FR:'🇫🇷 France', DE:'🇩🇪 Germany', JP:'🇯🇵 Japan', CN:'🇨🇳 China',
      KR:'🇰🇷 South Korea', PK:'🇵🇰 Pakistan', SA:'🇸🇦 Saudi Arabia',
      AE:'🇦🇪 UAE', ID:'🇮🇩 Indonesia', MY:'🇲🇾 Malaysia', SG:'🇸🇬 Singapore',
      TR:'🇹🇷 Turkey', EG:'🇪🇬 Egypt', NG:'🇳🇬 Nigeria', RU:'🇷🇺 Russia',
      MX:'🇲🇽 Mexico', AR:'🇦🇷 Argentina', PH:'🇵🇭 Philippines',
      VN:'🇻🇳 Vietnam', TH:'🇹🇭 Thailand', NL:'🇳🇱 Netherlands',
      SE:'🇸🇪 Sweden', NO:'🇳🇴 Norway',
    };

    // Created date from snowflake ID
    let createdDate = '';
    if (id) {
      const ts = Number(BigInt(id) >> 32n);
      createdDate = new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ');
    }

    return res.status(200).json({
      success: true,
      username: clean,
      name,
      bio: bio.trim(),
      avatar,
      followers,
      following,
      likes,
      videos,
      private: isPrivate,
      country: countryMap[country] || country || 'Unknown',
      created: createdDate,
      id,
      secuid,
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
