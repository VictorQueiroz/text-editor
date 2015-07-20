var _			= require('lodash');
var curry = _.curry;

function AppController ($scope) {
}

angular.module('textEditor', [
	'ui.router',
	'ngAnimate'
])
.config(function ($stateProvider, $urlRouterProvider) {
	$stateProvider
	.state('app', {
		url: '/app',
		templateUrl: 'app.html',
		controller: AppController
	});
	$urlRouterProvider.otherwise('/app/editor');
});