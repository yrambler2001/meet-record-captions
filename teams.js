(() => {
  const windowDirHandleKey = 'captionsDir';
  window.showDirectoryPicker({ mode: 'readwrite' }).then((dir) => {
    window[windowDirHandleKey] = dir;
  });
  const intervalId = setInterval(async () => {
    try {
      const captionsSelector = '[data-tid="closed-caption-renderer-wrapper"]';

      const windowMapKey = 'captionsMap';
      const windowParsedDataKey = 'captionsData';
      const windowMeetStartDateKey = 'meetStartDate';
      const windowMeetNameKey = 'meetName';

      window[windowMeetStartDateKey] = window[windowMeetStartDateKey] || new Date();

      if (!window[windowMeetNameKey]) {
        const title = document.title || 'unknown-meet';
        window[windowMeetNameKey] = title.trim().replace(/[^a-zA-Z0-9-]/g, '_');
      }

      const dir = window[windowDirHandleKey];
      if (!dir) {
        console.log('no dir');
        return;
      }

      window[windowMapKey] = window[windowMapKey] || new Map();
      const map = window[windowMapKey];

      const el = document.querySelector(captionsSelector);
      if (!el) {
        console.log('no captions element');
        return;
      }

      const fiberKey = Object.getOwnPropertyNames(el).find((p) => p.includes('reactFiber'));
      if (!fiberKey) {
        console.log('no react fiber');
        return;
      }

      const entries = el[fiberKey].child.pendingProps.currentEntries;
      if (!entries || !entries.length) return console.log('no captions');

      entries.forEach((entry, index) => {
        const { id, timestamp, text, user } = entry;

        if (!map.has(id)) {
          console.debug('added a new caption.');
          map.set(id, { date: timestamp, user: user.displayName, text });
          return;
        }

        const caption = map.get(id);
        caption.date = timestamp;
        caption.user = user.displayName;

        const captionTextInMap = caption.text;

        let shouldUpdate = true;

        if (captionTextInMap && captionTextInMap !== text) {
          if (index === 0 || index === 1) {
            const oldT = captionTextInMap.trim();
            const newT = text.trim();
            if (oldT.endsWith(newT) && newT.length < oldT.length) {
              shouldUpdate = false;
              console.debug(`ignoring truncation for ${id} (index ${index}) (keeping "${oldT.substring(0, 20)}...")`);
            }
          }
        }

        if (shouldUpdate) {
          if (captionTextInMap && captionTextInMap !== text) {
            console.debug(`updated ${id} from "${captionTextInMap}" to "${text}"`);
          }
          caption.text = text;
        }
      });

      const allKnownCaptionsSorted = [...map.values()].sort((a, b) => a.date - b.date);

      const textEntries = allKnownCaptionsSorted.map(
        (caption) => `${new Date(caption.date).toISOString()} ${caption.user}: ${caption.text}`,
      );

      window[windowParsedDataKey] = textEntries.join('\n');

      const dateStr = window[windowMeetStartDateKey].toISOString().replace(/:/g, '-');
      const filename = `${dateStr}_${window[windowMeetNameKey]}`;

      const fileHandle = await dir.getFileHandle(`${filename}.txt`, { create: true });

      const existingFile = await fileHandle.getFile();
      const existingFileText = await existingFile.text();
      const backupFileHandle = await dir.getFileHandle(`${filename}-backup.txt`, { create: true });
      const backupFileHandleWritable = await backupFileHandle.createWritable();
      try {
        await backupFileHandleWritable.write(existingFileText);
      } catch (e) {
        console.log(e);
      }
      await backupFileHandleWritable.close();

      const fileHandleWritable = await fileHandle.createWritable();
      try {
        await fileHandleWritable.write(window[windowParsedDataKey]);
      } catch (e) {
        console.log(e);
      }
      await fileHandleWritable.close();

      console.debug('completed');
    } catch (e) {
      console.log(e);
    }
  }, 5000);
  console.log('intervalId', intervalId)
})();
