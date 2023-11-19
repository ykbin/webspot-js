import postcss from 'postcss';
import postcssImport from 'postcss-import';
import autoPrefixer from 'autoprefixer';
import postcssMinify from '@csstools/postcss-minify';
import postcssGlobalData from '@csstools/postcss-global-data';
import postcssCustomProperties from 'postcss-custom-properties';

export default {
  build: (config) => {
    console.log(">>>", config);
  }
};
