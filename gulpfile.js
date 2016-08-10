'use strict';

/**
 * todo
 *
 * hb data
 *
 * CSSLint
 * CSS Uglify
 * CSS Specificity Graph Generator
 * SassDoc
 * https://github.com/anandthakker/doiuse
 *
 * Images
 * gulp-imagemin
 * imagemin-mozjpeg
 * imagemin-optipng
 * imagemin-pngquant
 *
 */

var gulp = require('gulp-help')(require('gulp'), {
    description: 'Display this help text for the gulp tasks.',
    aliases: ['h'],
    hideEmpty: true,
    hideDepsMessage: true
  }),
  browserSync = require('browser-sync').create(),
  htmlInjector = require("bs-html-injector"),
  argv = require('yargs').argv,
  del = require('del'),
  hb = require('gulp-hb'),
  sass = require('gulp-sass'),
  sourcemaps = require('gulp-sourcemaps'),
  autoprefixer = require('gulp-autoprefixer'),
  rename = require("gulp-rename"),
  runSequence = require('run-sequence'),
  cssnano = require('gulp-cssnano'),
  htmlmin = require('gulp-htmlmin'),
  concat = require('gulp-concat'),
  uglify = require('gulp-uglify'),
  gulpif = require('gulp-if'),
  access = require('gulp-accessibility'),
  eslint = require('gulp-eslint'),
  inlineSource = require('gulp-inline-source');


const path = require('path'),
  glob = require('glob');

var buildDirectory,
  isProduction = false;


/**
 * clean
 *
 * Delete output directory.
 * ========================================================================== */

gulp.task('build:clean', function () {
  return del([buildDirectory]);
});


/**
 * copy
 *
 *
 * ========================================================================== */

gulp.task('build:copy', function () {
  return gulp.src(['./src/**/*', '!./src/**/_*', '!./src/**/*.hbs', '!./src/styles/**/*.scss', '!./src/scripts/**/*.js'])
    .pipe(gulp.dest(buildDirectory))
});


/**
 * handlebars
 *
 * build templates: Compile handlebars templates
 * ========================================================================== */

gulp.task('build:handlebars', function () {
  return gulp.src(['./src/**/*.hbs', '!./src/_*/**'])
    .pipe(hb({
      partials: './src/_templates/_partials/**/*.hbs',
      data: './src/_templates/_data/**/*.json'
    }))
    .pipe(htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeOptionalTags: !!isProduction,
      caseSensitive: true
    }))
    .pipe(rename({extname: '.html'}))
    .pipe(gulp.dest(buildDirectory));
});


/**
 * css
 *
 * Compile SASS to CSS, create source maps and add vendor prefixes
 * ========================================================================== */

gulp.task('build:css', function () {
  return gulp.src('./src/styles/*.scss')
    .pipe(gulpif(!isProduction, sourcemaps.init()))
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({browsers: ['> 1%', 'last 2 versions', 'Firefox ESR'], cascade: false}))
    .pipe(cssnano())
    .pipe(gulpif(!isProduction, sourcemaps.write('./source-maps')))
    .pipe(gulp.dest(buildDirectory + '/styles'))
    .pipe(browserSync.stream({match: '**/*.css'}));
});


/**
 * js
 *
 *
 * ========================================================================== */

gulp.task('build:js', function () {
  return gulp.src(
    './src/scripts/**/*.js'
    // if the order is important, use an array
    /*[
     './src/scripts/1.js',
     './src/scripts/2.js'
     ]*/
  )
    .pipe(gulpif(!isProduction, sourcemaps.init()))
    .pipe(concat('main.min.js'))
    .pipe(uglify({
      compress: {
        //drop_console: true
      }
    }).on('error', console.log))
    .pipe(gulpif(!isProduction, sourcemaps.write('./source-maps')))
    .pipe(gulp.dest(buildDirectory + '/scripts'))
    .pipe(browserSync.stream());
});


/**
 * build
 *
 *
 * ========================================================================== */

gulp.task('build', function (done) {
  buildDirectory = isProduction ? './production' : './dist';
  runSequence(
    'build:clean',
    'build:copy',
    ['build:handlebars', 'build:css', 'build:js'],
    function () {
      done();
    }
  );
}, {
  aliases: ['b']
});


/**
 * develop
 *
 *
 * ========================================================================== */

gulp.task('develop', 'Starts a dev server, watching source files and auto injects/reloads on changes.', ['build'], function () {

  var open = argv.dob ? false : 'external';

  browserSync.use(htmlInjector, {
    files: buildDirectory + '/**/*.html'
  });

  browserSync.init({
    port: 9183,
    server: {baseDir: buildDirectory},
    notify: false,
    open: open,
    logPrefix: 'bbuildd',
    ui: {port: 9184},
    reloadOnRestart: true,
    logFileChanges: false,
    timestamps: false
  });

  //gulp.watch(['./src/**/*', '!./src/**/*.{html,hbs,scss}'], ['build:copy']);
  gulp.watch(['./src/**/*.hbs', './src/_templates/_data/**/*.json'], ['build:handlebars']);
  gulp.watch(['./src/styles/**/*.scss'], ['build:css']);
  gulp.watch(['./src/scripts/**/*.js'], ['build:js']);
}, {
  aliases: ['d', 'dev'],
  options: {
    'dob': 'Don\'t open a browser.'
  }
});


/**
 * inline-source
 *
 *
 * ========================================================================== */


function optimiseInlineSourceDelete(source, context, next) {
  var currentDirectory = path.dirname(source.filepath);
  // delete the inlined file
  del.sync(source.filepath);
  // delete the folder the inlined file was part of if it is empty
  if (glob.sync(currentDirectory + '/*.*').length === 0) {
    del.sync(currentDirectory);
  }
  // step to the next file to inline
  next();
}


gulp.task('optimise:inline-source', function () {
  return gulp.src(buildDirectory + '/**/*.html')
    .pipe(inlineSource({
      attribute: 'data-inline',
      compress: false,
      handlers: [optimiseInlineSourceDelete],
      swallowErrors: true
    }))
    .pipe(gulp.dest(buildDirectory));
});


/**
 * validate html
 *
 *
 * ========================================================================== */

gulp.task('validate:html', function () {
  return gulp.src(buildDirectory + '/**/*.html')
    .pipe(access({
      force: true,
      accessibilityLevel: 'WCAG2AAA',
      reportLevels: {
        notice: true,
        warning: true,
        error: true
      }
    }))
    .on('error', console.log);
});


/**
 * validate js
 *
 *
 * ========================================================================== */

gulp.task('validate:js', function () {
  return gulp.src('./src/scripts/**/*.js')
    .pipe(eslint())
    .pipe(eslint.format());
});


/**
 * production
 *
 *
 * ========================================================================== */

gulp.task('production', 'Compiles all source files to the production-folder and performs optimisations and validations.', function (done) {
  isProduction = true;
  runSequence(
    'build',
    'optimise:inline-source',
    ['validate:html', 'validate:js'],
    function () {
      done();
    }
  );
}, {
  aliases: ['p', 'prod']
});
