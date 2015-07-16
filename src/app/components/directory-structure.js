var _				= require('lodash');
var fs 			= require('fs');
var glob 		= require('glob');
var path 		= require('path');
var first		= _.first;

angular.module('textEditor')
.directive('directoryStructure', function ($process, EditorService) {
	return {
		templateUrl: 'components/directory-structure.html',
		scope: {},
		controller: function ($scope, $element, $attrs) {
			var cwd = $process.cwd();

			function getFileName(path) {
				return first(/([A-z]+(\s)?\.[A-z]+)$/.exec(path));
			}

			var files = glob.sync(path.resolve(cwd, '*.*')).map(function (path) {
				return { path: path, name: getFileName(path) };
			});

			$scope.files = files;

			var defaultEditor = EditorService.getEditor('default');

			this.readFile = function (file) {
				defaultEditor.readFile(file);
			};

			this.isActive = function (file) {
				var activeTab = defaultEditor.getActiveTab();
				return activeTab && activeTab.compareFile(file);
			};
		},
		controllerAs: 'structureCtrl'
	};
})