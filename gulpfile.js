'use strict';

/**
 * todo
 *
 * hb layouts
 * hb data
 * hb helper
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
    description: 'Display this help text for all bbuildd gulp tasks.',
    aliases: ['h'],
    hideEmpty: true
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
  parker = require('gulp-parker'),
  inlineSource = require('gulp-inline-source');


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

/*gulp.task('build:copy', function () {
 return gulp.src(['./src/!**!/!*', '!./src/!**!/!*.hbs', '!./src/{partials,partials/!**}', '!./src/{sass,sass/!**}'])
 .pipe(gulp.dest(buildDirectory))
 });*/


/**
 * handlebars
 *
 * build templates: Compile handlebars templates
 * ========================================================================== */

gulp.task('build:handlebars', function () {
  return gulp.src(['./src/**/*.hbs', '!./src/_*/**'])
    .pipe(hb({
      partials: './src/_templates/_partials/**/*.hbs'
    }))
    .pipe(htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeOptionalTags: false, // todo: true for PROD
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

gulp.task('develop', 'develop task description.', ['build'], function () {

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
  gulp.watch(['./src/**/*.hbs'], ['build:handlebars']);
  gulp.watch(['./src/styles/**/*.scss'], ['build:css']);
  gulp.watch(['./src/scripts/**/*.js'], ['build:js']);
}, {
  aliases: ['d', 'dev'],
  options: {
    'dob': 'Don\'t open browser.'
  }
});


/**
 * inline-source
 *
 *
 * ========================================================================== */

gulp.task('optimise:inline-source', function () {
  return gulp.src(buildDirectory + '/**/*.html')
    .pipe(inlineSource({
      attribute: 'data-bbuildd-inline',
      compress: false
    }))
    // todo: delete inlined files
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

gulp.task('production', 'production task description.', function (done) {
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
