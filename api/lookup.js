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

    // Extract user detail block
    const parts = html.split('webapp.user-detail"');
    if (parts.length < 2) {
      return res.status(404).json({ success: false, error: `User not found: @${clean}` });
    }
    const userData = parts[1].split('"RecommendUserList"')[0];

    // Try to parse JSON directly from the block
    let userJson = null;
    try {
      const jsonStart = userData.indexOf('{"user":');
      if (jsonStart !== -1) {
        // find matching closing brace
        let depth = 0, i = jsonStart, end = -1;
        for (; i < userData.length; i++) {
          if (userData[i] === '{') depth++;
          else if (userData[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) userJson = JSON.parse(userData.slice(jsonStart, end + 1));
      }
    } catch(_) { userJson = null; }

    function between(str, start, end) {
      const s = str.indexOf(start);
      if (s === -1) return '';
      const sub = str.slice(s + start.length);
      const e = sub.indexOf(end);
      if (e === -1) return '';
      return sub.slice(0, e);
    }

    // Use parsed JSON if available, else fall back to string extraction
    let name, bio, country, isPrivate, followers, following, likes, videos, secuid, avatar, id;

    if (userJson && userJson.user) {
      const u = userJson.user;
      const s = userJson.stats || {};
      name      = u.nickname || '';
      bio       = (u.signature || '').replace(/\\n/g, '\n');
      country   = u.region || '';
      isPrivate = !!u.privateAccount;
      followers = s.followerCount || 0;
      following = s.followingCount || 0;
      likes     = s.heartCount || s.heart || 0;
      videos    = s.videoCount || 0;
      secuid    = u.secUid || '';
      avatar    = u.avatarLarger || '';
      id        = u.id || '';
    } else {
      id        = between(userData, '"id":"', '",');
      name      = between(userData, '"nickname":"', '",');
      bio       = between(userData, '"signature":"', '",').replace(/\\n/g, '\n');
      // FIX: country uses closing `"` not `",`
      country   = between(userData, '"region":"', '"');
      // Only take 2-char country code
      country   = country.length <= 3 ? country : '';
      isPrivate = between(userData, '"privateAccount":', ',') === 'true';
      followers = parseInt(between(userData, '"followerCount":', ',')) || 0;
      following = parseInt(between(userData, '"followingCount":', ',')) || 0;
      likes     = parseInt(between(userData, '"heart":', ',')) || 0;
      videos    = parseInt(between(userData, '"videoCount":', ',')) || 0;
      secuid    = between(userData, '"secUid":"', '"');
      avatar    = between(userData, '"avatarLarger":"', '"').replace(/\\u002F/g, '/');
    }

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
      try {
        const ts = Number(BigInt(id) >> 32n);
        createdDate = new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ');
      } catch(_) {}
    }

    return res.status(200).json({
      success:  true,
      username: clean,
      name,
      bio:      bio.trim(),
      avatar,
      followers,
      following,
      likes,
      videos,
      private:  isPrivate,
      country:  countryMap[country] || (country && country.length <= 3 ? country : '🌍 Unknown'),
      created:  createdDate,
      id,
      secuid,
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
