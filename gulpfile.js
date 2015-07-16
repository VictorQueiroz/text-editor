var _ 					= require('lodash');
var gulp 				= require('gulp');
var jade 				= require('gulp-jade');
var sort 				= require('gulp-sort');
var sass 				= require('gulp-sass');
var concat			= require('gulp-concat');
var wiredep			= require('wiredep').stream;
var livereload		= require('gulp-livereload');
var ngAnnotate	= require('gulp-ng-annotate');
var ngTemplates	= require('gulp-ng-templates');

const PATHS = {
	stylesheets: 	[
		'stylesheets/**/*.scss',
		'src/app/**/*.scss'
	],

	scripts: 			['src/app/**/*.js'],

	templates: 		['src/app/**/*.jade'],

	indexPage: 		[
		'src/index.html'
	]
};

gulp.task('indexPage', function () {
	gulp.src(PATHS.indexPage)
	.pipe(wiredep({
		exclude: [
			/bootstrap/
		]
	}))
	.pipe(gulp.dest('www'));
});

gulp.task('stylesheets', function () {
	gulp.src('stylesheets/app.scss')
	.pipe(sass())
	.pipe(gulp.dest('www/css'));
});

gulp.task('scripts', function () {
	gulp.src(PATHS.scripts)
	.pipe(sort(function (file1, file2) {
		if(file1.path.indexOf('app.js') > -1) {
			return -1;
		}
		return 1;
	}))
	.pipe(ngAnnotate())
	.pipe(concat('app.js'))
	.pipe(gulp.dest('www/js'));
});

gulp.task('templates', function () {
	gulp.src(PATHS.templates)
	.pipe(jade({
		doctype: 'html'
	}))
	.pipe(ngTemplates({
		filename: 'templates.js',
		module: 'textEditor',
		standalone: false
	}))
	.pipe(gulp.dest('www/js'));
});

gulp.task('watch', function () {
	_.forEach(PATHS, function (files, taskName) {
		gulp.watch(files, [taskName]);
	});

	gulp.watch('bower.json', ['indexPage']);
});

gulp.task('livereload', function () {
	livereload.listen();

	gulp.watch([
		'www/index.html',
		'www/{css,js}/**/*.*'
	]).on('change', livereload.changed);
});

gulp.task('default', ['watch', 'livereload']);