const _UUIDPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UUIDPattern = new RegExp(_UUIDPattern.source, 'i');


export function uuid(): string {
  let d = new Date().getTime();

  if(typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now(); // use high-precision timer if available
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
      
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export const uuidWithoutDashes = () => uuid().replace(/-/g, '');

export const shortId = () => uuid().split('-').at(-1) as string;
