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
  LGBT: 'misc/lgbt',
  TWEET: 'misc/tweet',
  YOUTUBE_COMMENT: 'misc/youtube-comment',
};

export async function getRandomFilteredAvatar(avatarUrl) {
  const filters = Object.values(AVATAR_FILTERS);
  const randomFilter = filters[Math.floor(Math.random() * filters.length)];
  
  const url = `${CANVAS_API_BASE}/${randomFilter}?avatar=${encodeURIComponent(avatarUrl)}`;
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao aplicar filtro ${randomFilter}:`, error.message);
    throw error;
  }
}

export async function getRandomOverlayAvatar(avatarUrl, params = {}) {
  const overlays = Object.values(CANVAS_OVERLAYS);
  const randomOverlay = overlays[Math.floor(Math.random() * overlays.length)];
  
  let url = `${CANVAS_API_BASE}/${randomOverlay}?avatar=${encodeURIComponent(avatarUrl)}`;
  
  if (randomOverlay === 'misc/tweet' && params.tweetData) {
    const tweetParams = new URLSearchParams({
      displayname: params.tweetData.displayname || 'Discord User',
      username: params.tweetData.username || 'user',
      comment: params.tweetData.comment || 'Que notícia incrível!',
      theme: params.tweetData.theme || 'dark',
      avatar: encodeURIComponent(avatarUrl),
    });
    url = `${CANVAS_API_BASE}/misc/tweet?${tweetParams}`;
  } else if (randomOverlay === 'misc/youtube-comment' && params.youtubeData) {
    const youtubeParams = new URLSearchParams({
      username: params.youtubeData.username || 'Discord User',
      comment: params.youtubeData.comment || 'Ótimo vídeo!',
      avatar: encodeURIComponent(avatarUrl),
    });
    url = `${CANVAS_API_BASE}/misc/youtube-comment?${youtubeParams}`;
  }
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao aplicar overlay ${randomOverlay}:`, error.message);
    throw error;
  }
}

export async function getFilteredAvatar(avatarUrl, filter) {
  const url = `${CANVAS_API_BASE}/${filter}?avatar=${encodeURIComponent(avatarUrl)}`;
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao aplicar filtro ${filter}:`, error.message);
    throw error;
  }
}


export async function getOverlayAvatar(avatarUrl, overlay, params = {}) {
  let url = `${CANVAS_API_BASE}/${overlay}?avatar=${encodeURIComponent(avatarUrl)}`;
  
  if (overlay === 'misc/tweet' && params.tweetData) {
    const tweetParams = new URLSearchParams({
      displayname: params.tweetData.displayname || 'Discord User',
      username: params.tweetData.username || 'user',
      comment: params.tweetData.comment || 'Que notícia incrível!',
      theme: params.tweetData.theme || 'dark',
      avatar: encodeURIComponent(avatarUrl),
    });
    url = `${CANVAS_API_BASE}/misc/tweet?${tweetParams}`;
  } else if (overlay === 'misc/youtube-comment' && params.youtubeData) {
    const youtubeParams = new URLSearchParams({
      username: params.youtubeData.username || 'Discord User',
      comment: params.youtubeData.comment || 'Ótimo vídeo!',
      avatar: encodeURIComponent(avatarUrl),
    });
    url = `${CANVAS_API_BASE}/misc/youtube-comment?${youtubeParams}`;
  }
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao aplicar overlay ${overlay}:`, error.message);
    throw error;
  }
}
