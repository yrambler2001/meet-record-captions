// select webclient iframe in devtools

(() => {
  const windowDirHandleKey = 'captionsDir';
  window.showDirectoryPicker({ mode: 'readwrite' }).then((dir) => {
    window[windowDirHandleKey] = dir;
  });
  const intervalId = setInterval(async () => {
    try {
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

      const subtitleItem = document.querySelector('.live-transcription-subtitle__item');
      if (!subtitleItem) {
        console.log('no captions element');
        return;
      }

      const el = subtitleItem.parentElement.parentElement;
      const fiberKey = Object.getOwnPropertyNames(el).find((p) => p.includes('reactFiber'));
      if (!fiberKey) {
        console.log('no react fiber');
        return;
      }

      let messages;
      try {
        messages = el[fiberKey].child.dependencies.firstContext.memoizedValue.store.getState().newLiveTranscription.newLTMessage;
      } catch (e) {
        console.log('failed to access transcription store', e);
        return;
      }

      if (!messages || !Object.keys(messages).length) {
        console.log('no captions');
        return;
      }

      Object.values(messages).forEach((entry) => {
        const { msgId, messageTime, displayName, text } = entry;

        if (!map.has(msgId)) {
          console.debug('added a new caption.');
          const [h, m, s] = messageTime.split(':').map(Number);
          const date = new Date(window[windowMeetStartDateKey]);
          date.setHours(h, m, s, 0);
          map.set(msgId, { date, displayName, text });
          return;
        }

        const caption = map.get(msgId);
        caption.displayName = displayName;

        const captionTextInMap = caption.text;
        if (captionTextInMap !== text) {
          console.debug(`updated ${msgId} from "${captionTextInMap}" to "${text}"`);
          caption.text = text;
        }
      });

      const allKnownCaptionsSorted = [...map.values()].sort((a, b) => a.date - b.date);

      const textEntries = allKnownCaptionsSorted.map(
        (caption) => `${caption.date.toISOString()} ${caption.displayName}: ${caption.text}`,
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
