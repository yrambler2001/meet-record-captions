(() => {
  const windowDirHandleKey = 'captionsDir';
  window.showDirectoryPicker({ mode: 'readwrite' }).then((dir) => {
    window[windowDirHandleKey] = dir;
  });
  const intervalId = setInterval(async () => {
    try {
      const parentElementOfCaptionsSelector = '[aria-label="Captions"]';

      const windowMapKey = 'captionsMap';
      const windowParsedDataKey = 'captionsData';
      const windowMeetStartDateKey = 'meetStartDate';
      const windowMeetNameKey = 'meetName';
      const windowCaptionMaxKey = 'captionMaxKey';

      const captionDOMElementKey = 'captionKey';
      const captionDOMElementDateKey = 'captionDate';

      const captionMapElementDateKey = 'captionDate';
      const captionMapElementUserKey = 'captionUser';
      const captionMapElementTextKey = 'captionText';

      window[windowMeetStartDateKey] = window[windowMeetStartDateKey] || new Date();

      if (!window[windowMeetNameKey]) {
        const titleElement = document.querySelector('[data-meeting-title]');
        const title = titleElement ? titleElement.getAttribute('data-meeting-title') : 'unknown-meet';
        window[windowMeetNameKey] = title.trim().replace(/[^a-zA-Z0-9-]/g, '_');
      }

      const dir /*: FileSystemDirectoryHandle */ = window[windowDirHandleKey];
      if (!dir) {
        console.log('no dir');
        return;
      }

      window[windowMapKey] = window[windowMapKey] || new Map();
      const map = window[windowMapKey];
      const captionsParent = document.querySelector(parentElementOfCaptionsSelector);
      if (!captionsParent) {
        console.log('no captions parent');
        return;
      }
      const captions = [...captionsParent.children].filter(
        (captionElement) => !captionElement.querySelector('button') /* "scroll to bottom" button */ && captionElement.children[1] /* caption has text */,
      );

      if (!captions.length) return console.log('no captions');

      captions.forEach((captionElement) => {
        if (!captionElement[captionDOMElementKey]) {
          window[windowCaptionMaxKey] = (window[windowCaptionMaxKey] || 0) + 1;
          captionElement[captionDOMElementKey] = window[windowCaptionMaxKey];
          captionElement[captionDOMElementDateKey] = +new Date();
        }
      });
      captions.forEach((captionElement, index) => {
        const captionKey = captionElement[captionDOMElementKey];
        if (!map.get(captionKey)) {
          console.debug('added a new caption.');
          map.set(captionKey, {});
        }
        const caption = map.get(captionKey);
        caption[captionMapElementDateKey] = captionElement[captionDOMElementDateKey];
        caption[captionMapElementUserKey] = captionElement.children[0].innerText;

        const captionTextInDOM = captionElement.children[1].innerText;
        const captionTextInMap = caption[captionMapElementTextKey];

        let shouldUpdate = true;

        // If text exists and has changed, check for truncation based on index
        if (captionTextInMap && captionTextInMap !== captionTextInDOM) {
          if (index === 0 || index === 1) {
            // Index 0 or 1: Start of sliding window. Distrust truncation.
            const oldT = captionTextInMap.trim();
            const newT = captionTextInDOM.trim();

            // If Old ends with New (and New is shorter), it's a meet truncation artifact.
            if (oldT.endsWith(newT) && newT.length < oldT.length) {
              shouldUpdate = false;
              console.debug(`ignoring truncation for ${captionKey} (index ${index}) (keeping "${oldT.substring(0, 20)}...")`);
            }
          }
          // Index > 0 or 1: Middle/End of window. Trust the correction implicitly.
        }

        if (shouldUpdate) {
          if (captionTextInMap && captionTextInMap !== captionTextInDOM) {
            console.debug(`updated ${captionKey} from "${captionTextInMap}" to "${captionTextInDOM}"`);
          }
          caption[captionMapElementTextKey] = captionTextInDOM;
        }
      });

      const allKnownCaptionsSorted = [...map.entries()].sort(([key1], [key2]) => key1 - key2);

      const textEntries = allKnownCaptionsSorted.map(
        ([_key, caption]) =>
          `${new Date(caption[captionMapElementDateKey]).toISOString()} ${caption[captionMapElementUserKey]}: ${caption[captionMapElementTextKey]}`,
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
