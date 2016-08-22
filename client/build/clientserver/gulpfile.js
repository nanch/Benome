'use strict';

/*
Copyright 2016 Steve Hazel

This file is part of Benome.

Benome is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License version 3
as published by the Free Software Foundation.

Benome is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Benome. If not, see http://www.gnu.org/licenses/.
*/

var gulp = require('gulp');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var watchify = require('watchify');
var browserify = require('browserify');
var _ = require('lodash');

gulp.task('prod', function() {
  var bundler = browserify({
    entries: ['../../js/Entry.js'],
    debug: true
  });

  var bundle = function() {
    return bundler
      .bundle()
      .pipe(source('bundle.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true}))
         .pipe(uglify())
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./deploy/static/js'));
  };

  var bundleResult = bundle();
  gulp.src(['../../html/clientserver/*']).pipe(gulp.dest('./deploy'));
  gulp.src(['../../images/*']).pipe(gulp.dest('./deploy/static/images'));
  gulp.src(['../../css/*']).pipe(gulp.dest('./deploy/static/css'));
  return bundleResult;
});

var devBundler = watchify(browserify('../../js/Entry.js', watchify.args));
function bundle() {
  gulp.src(['../../html/clientserver/*']).pipe(gulp.dest('./deploy'));
  gulp.src(['../../images/*']).pipe(gulp.dest('./deploy/static/images'));
  gulp.src(['../../css/*']).pipe(gulp.dest('./deploy/static/css'));

  return devBundler.bundle()
    // log errors if they happen
    .on('error', function(error) {
        //gutil.log.bind(gutil, 'Browserify Error'))
        gutil.log('Browserify Error', error.toString());
    })
    .on('end', function() {
      gutil.log('Compile finished', new Date());
    })
    .pipe(source('bundle.js'))
    
    /*// optional, remove if you dont want sourcemaps
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
      .pipe(sourcemaps.write('./')) // writes .map file*/

    .pipe(gulp.dest('./deploy/static/js'));
}
gulp.task('dev', bundle);
devBundler.on('update', bundle); // on any dep update, runs the bundler
