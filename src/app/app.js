function AppController ($scope) {
}

angular.module('textEditor', [
	'ui.router'
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