'use strict';

var PATH_BUILD_DEVELOPMENT = './dist';
var PATH_BUILD_PRODUCTION = './production';

var PATH_SOURCE_TEMPLATES = './src/_templates';
var PATH_SOURCE_STYLES = './src/styles';
var PATH_SOURCE_SCRIPTS = './src/scripts';
var PATH_SOURCE_IMAGES = './src/images';

var AUTOPREFIXER_BROWSERS = ['> 1%', 'last 2 versions', 'Firefox ESR'];


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
  sassLint = require('gulp-sass-lint'),
  sourcemaps = require('gulp-sourcemaps'),
  autoprefixer = require('gulp-autoprefixer'),
  rename = require("gulp-rename"),
  runSequence = require('run-sequence'),
  cssnano = require('gulp-cssnano'),
  htmlmin = require('gulp-htmlmin'),
  imagemin = require('gulp-imagemin'),
  concat = require('gulp-concat'),
  uglify = require('gulp-uglify'),
  gulpif = require('gulp-if'),
  access = require('gulp-accessibility'),
  eslint = require('gulp-eslint'),
  inlineSource = require('gulp-inline-source');


var path = require('path'),
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
  return gulp.src([
    './src/**/*',
    '!./src/**/*.hbs',
    '!./src/**/{_*,_*/**}',
    '!' + PATH_SOURCE_STYLES + '/**/*.scss',
    '!' + PATH_SOURCE_SCRIPTS + '/**/*.js',
    '!' + PATH_SOURCE_IMAGES + '/**/*'
  ])
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
      partials: PATH_SOURCE_TEMPLATES + '/_partials/**/*.hbs',
      data: PATH_SOURCE_TEMPLATES + '/_data/**/*.json'
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
 * images
 *
 *
 * ========================================================================== */

gulp.task('build:images', function () {
  return gulp.src(PATH_SOURCE_IMAGES + '/**/*.{jpg,jpeg,png,gif,svg}')
    .pipe(imagemin({
      progressive: true,
      interlaced: true
    }))
    .pipe(gulp.dest(buildDirectory + '/images'));
});


/**
 * css
 *
 * Compile SASS to CSS, create source maps and add vendor prefixes
 * ========================================================================== */

gulp.task('build:css', function () {
  return gulp.src(PATH_SOURCE_STYLES + '/*.scss')
    .pipe(gulpif(!isProduction, sourcemaps.init()))
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({browsers: AUTOPREFIXER_BROWSERS, cascade: false}))
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
    PATH_SOURCE_SCRIPTS + '/**/*.js'
    // if the order is important, use an array
    /*[
     PATH_SOURCE_SCRIPTS + '/1.js',
     PATH_SOURCE_SCRIPTS + '/2.js'
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
  buildDirectory = isProduction ? PATH_BUILD_PRODUCTION : PATH_BUILD_DEVELOPMENT;
  runSequence(
    'build:clean',
    'build:copy',
    ['build:handlebars', 'build:images', 'build:css', 'build:js'],
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

  gulp.watch(['./src/**/*.hbs', PATH_SOURCE_TEMPLATES + '/_data/**/*.json'], ['build:handlebars']);
  gulp.watch([PATH_SOURCE_IMAGES + '/**/*'], ['build:images']);
  gulp.watch([PATH_SOURCE_STYLES + '/**/*.scss'], ['build:css']);
  gulp.watch([PATH_SOURCE_SCRIPTS + '/**/*.js'], ['build:js']);
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
      accessibilityLevel: 'WCAG2AA',
      reportLevels: {
        notice: true,
        warning: true,
        error: true
      }
    }))
    .on('error', console.log);
});


/**
 * validate sass
 *
 *
 * ========================================================================== */

gulp.task('validate:sass', function () {
  return gulp.src(PATH_SOURCE_STYLES + '/**/*.scss')
    .pipe(sassLint({
      rules: {
        'pseudo-element': 0,
        'force-pseudo-nesting': 0
      }
    }))
    .pipe(sassLint.format())
    .pipe(sassLint.failOnError());
});


/**
 * validate js
 *
 *
 * ========================================================================== */

gulp.task('validate:js', function () {
  return gulp.src(PATH_SOURCE_SCRIPTS + '/**/*.js')
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
    ['validate:html', 'validate:sass', 'validate:js'],
    function () {
      done();
    }
  );
}, {
  aliases: ['p', 'prod']
});
