import axios from 'axios';

const CANVAS_API_BASE = 'https://api.some-random-api.com/canvas';

export const AVATAR_FILTERS = {
  INVERT: 'filter/invert',
  RED: 'filter/red',
  PIXELATE: 'filter/pixelate',
};

export const CANVAS_OVERLAYS = {
  WASTED: 'overlay/wasted',
  JAIL: 'overlay/jail',
  COMRADE: 'overlay/comrade',
  GAY: 'overlay/gay',
  LGBT: 'misc/lgbt',
  BISEXUAL: 'misc/bisexual',
  TRANSGENDER: 'misc/transgender',
  INVERT: 'filter/invert',
  RED: 'filter/red',
  PIXELATE: 'filter/pixelate',
};

export async function getRandomFilteredAvatar(avatarUrl) {
  const filters = Object.values(AVATAR_FILTERS);
  const randomFilter = filters[Math.floor(Math.random() * filters.length)];
  
  const url = `${CANVAS_API_BASE}/${randomFilter}`;
  
  try {
    const response = await axios.get(url, {
      params: { avatar: avatarUrl },
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao aplicar filtro ${randomFilter}: ${error.response?.status || error.code} - ${error.message}`);
    throw error;
  }
}

export async function getRandomOverlayAvatar(avatarUrl) {
  const overlays = Object.values(CANVAS_OVERLAYS);
  const randomOverlay = overlays[Math.floor(Math.random() * overlays.length)];
  
  const url = `${CANVAS_API_BASE}/${randomOverlay}`;
  
  return `${url}?avatar=${encodeURIComponent(avatarUrl)}`;
}

export async function getRandomOverlayAvatarBuffer(avatarUrl) {
  const overlays = Object.values(CANVAS_OVERLAYS);
  const randomOverlay = overlays[Math.floor(Math.random() * overlays.length)];
  const url = `${CANVAS_API_BASE}/${randomOverlay}`;

  try {
    const response = await axios.get(url, {
      params: { avatar: avatarUrl },
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao aplicar overlay ${randomOverlay}: ${error.response?.status || error.code} - ${error.message}`);
    throw error;
  }
}


export async function getOverlayAvatar(avatarUrl, overlay) {
  const url = `${CANVAS_API_BASE}/${overlay}`;
  
  try {
    const response = await axios.get(url, {
      params: { avatar: avatarUrl },
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao aplicar overlay ${overlay}: ${error.response?.status || error.code} - ${error.message}`);
    throw error;
  }
}

export async function createTweetImage(avatarUrl, username, displayName, comment, theme = 'dark') {
  const params = new URLSearchParams({
    avatar: avatarUrl,
    username: username || 'user',
    displayname: displayName || 'Discord User',
    comment: comment || '',
    theme: theme,
  });
  
  const url = `${CANVAS_API_BASE}/misc/tweet?${params.toString()}`;
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao criar tweet image: ${error.response?.status || error.code} - ${error.message}`);
    throw error;
  }
}


export async function createYoutubeCommentImage(avatarUrl, username, comment) {
  const params = new URLSearchParams({
    avatar: avatarUrl,
    username: username || 'Discord User',
    comment: comment || '',
  });
  
  const url = `${CANVAS_API_BASE}/misc/youtube-comment?${params.toString()}`;
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao criar youtube comment image: ${error.response?.status || error.code} - ${error.message}`);
    throw error;
  }
}
