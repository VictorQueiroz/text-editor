function EditorController($scope) {
}

angular.module('textEditor')
.config(function ($stateProvider) {
	$stateProvider
	.state('app.editor', {
		url: '/editor',
		templateUrl: 'app-editor.html',
		controller: EditorController,
		controllerAs: 'editorCtrl'
	});
});