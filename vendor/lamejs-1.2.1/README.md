# lamejs 1.2.1: notices, source and replacement

SONIC CHAOS uses **lamejs 1.2.1**, the JavaScript port of the **LAME MP3 Encoder**. See the [LAME project](https://lame.sourceforge.io/) and the [lamejs project](https://github.com/zhuker/lamejs). The published npm metadata declares LGPL-3.0. See [LGPL 3.0](LGPL-3.0.txt), its incorporated [GPL 3.0](GPL-3.0.txt), and the [upstream notice](LICENSE). The original package includes the authors’ copyright notices and historical LAME notices; these are retained verbatim.

[Download the exact corresponding source distribution](lamejs-1.2.1.tgz), as published by npm. Extract with `tar -xzf lamejs-1.2.1.tgz`. It includes readable JavaScript and Java sources, build materials, notices, and the published browser bundle. The local `lame.min.js` is the identical, unmodified browser bundle from the archive.

- Published artifact: https://registry.npmjs.org/lamejs/-/lamejs-1.2.1.tgz
- Registry SHA-512 SRI: `sha512-s7bxvjvYthw6oPLCm5pFxvA84wUROODB8jEO2+CE1adhKgrIvVOlmMgY8zyugxGrvRaDHNJanOiS21/emty6dQ==`
- Browser bundle SHA-256: `15d285e2587b3bdbfd18a68de6ce07cc074f7480a82c3815da2dc1c348ec6df4`

The app source and worker are separate from the encoder and are included in the project ZIP. To run with a modified compatible version, replace `vendor/lamejs-1.2.1/lame.min.js` in the extracted project with your own build exposing `lamejs.Mp3Encoder`, then reload the page and select MP3. The worker loads the local file dynamically; the browser does not enforce the release checksum. Recipients may modify the library and reverse engineer the combined work to debug those modifications as provided by the LGPL. Keep the vendor directory, source archive and notices available alongside any deployment of this release.
