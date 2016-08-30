# Benome

[Benome](https://benome.ca) captures, processes, and visualizes observed behavior. It's a user interface, a prediction engine, and a self-persuasion system all tied into a neat package that helps anyone solve any problem.

If you think it could do so much more than that, you're absolutely right. But we'll keep it simple for now.

## Building the client

### One-time Setup 

#### Install latest NodeJS & NPM
[NodeJS installer page](https://nodejs.org/en/download/package-manager/)

#### Clone the repository
	git clone https://bitbucket.org/shazel/benome.git

#### Install the various NPM modules

*In benome/client/*

	npm install backbone underscore hammerjs jquery@2.2.4 jquery.mousewheel jquery.event.drag d3 moment
	cd node_modules
	ln -s ../js app
	cd ..

*In benome/client/build*

	npm install gulp gulp-util gulp-sourcemaps gulp-uglify vinyl-source-stream vinyl-buffer watchify browserify lodash

### Build client-only version (LocalStorage persistence)
*In benome/client/build/clientonly/*

#### Development build with auto-reloading
	gulp dev

#### Minified build with source maps
	gulp prod

## Setting up the server

*Coming soon*