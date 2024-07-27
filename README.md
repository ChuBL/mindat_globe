# Macrostrat's map interface

Macrostrat's map interface is the intersection of stratigraphic, bedrock, paleoenvironment, and paleontology data in the modern world.

Currently the application is bundled using webpackv5; however, in the near future we will be transitioning to use [NextJs](https://nextjs.org/) to take advantage of server-side rendering, simplified page routing, and already managed bundling.

## Getting started

This package requires relatively new features of package managers for multi-package workspaces.
Make sure you have NPM version 7 or higher. This can be installed with `npm install -g npm@7`.
This package also works with yarn.

You will need to download the data from the openmindat python package. A download file is already setup and can be found in the public directory. This current version uses the jsonDownload.py file. You will need an openminda api key, if you do not have one, you can follow these instructions. https://www.mindat.org/a/how_to_get_my_mindat_api_key

Install dependencies with `npm bootstrap` (which is simply an alias to `npm install --workspaces && npm install`).

To begin the development server run `npm run dev`. The server will be hosted to `localhost:3000` by defualt.
