export const padNumber = (value) => String(value).padStart(2, '0');

export const formatSnapshotTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());
  const seconds = padNumber(date.getSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
};
