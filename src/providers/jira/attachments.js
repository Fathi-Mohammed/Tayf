'use strict';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function onThisSite(client, url) {
  return String(url || '').startsWith(`https://${client.site}/`);
}

async function attachFile(client, key, file) {
  const created = await client.postFile(
    `/rest/api/3/issue/${encodeURIComponent(key)}/attachments`,
    file
  );
  const attachment = (created || [])[0];
  if (!attachment) return null;

  return {
    id: attachment.id,
    name: attachment.filename,
    mime: attachment.mimeType,
    url: attachment.content
  };
}

async function readImage(client, url) {
  if (!onThisSite(client, url)) return null;

  const { mime, bytes } = await client.fetchBinary(url);
  if (!mime.startsWith('image/') || bytes.length > MAX_IMAGE_BYTES) return null;
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

module.exports = { attachFile, readImage, MAX_IMAGE_BYTES };
