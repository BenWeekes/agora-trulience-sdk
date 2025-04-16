const originalFetch = window.fetch;

window.fetch = function (input, init) {
    const SPECIAL_URL =
      "https://digitalhuman.uk/chunks/a74adcb06c3b1b07c36a90271b98305857ec3be1";
    const LOCAL_PUBLIC_FILE_PATH = "/a74adcb06c3b1b07c36a90271b98305857ec3be1";

    const requestUrl = typeof input === 'string' ? input : input.url;

    if (requestUrl.includes(SPECIAL_URL)) {
      return fetch(LOCAL_PUBLIC_FILE_PATH)
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }

          return response.arrayBuffer();
        })
        .then(buffer => {
          const init = {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'gzip'
            }
          };
          return new Response(buffer, init);
        })
        .catch(error => {
          return Promise.reject(error);
        });
    } else {
      return originalFetch(input, init);
    }
  };
