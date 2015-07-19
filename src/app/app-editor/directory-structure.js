var Q 		= require('q');
var fs 		= require('../modules/fs');
var path 	= require('path');
var glob		= require('../modules/glob');

function DirectoryStructureFactory ($process, EditorService, DirectoryStructure) {
	return {
		templateUrl: 'app-editor/directory-structure.html',
		scope: {},
		controller: function ($scope, $element, $attrs) {
			$scope.files = [];

			var cwd = $process.cwd();

			var defaultEditor = EditorService.getEditor('default');

			this.readFile = function (file) {
				defaultEditor.readFile(file);
			};

			this.isActive = function (file) {
				var activeTab = defaultEditor.getActiveTab();
				return activeTab && activeTab.compareFile(file);
			};

			fs.readdir(process.cwd()).then(function (files) {
				return Q.all(map(filter(files, function (file) {
					return file !== 'node_modules';
				}), function (file) {
					return fs.stat(file).then(function (stat) {
						if(stat.isDirectory()) {
							return glob(path.resolve(file, '**/*.*'));
						} else {
							return file;
						}
					});
				}));
			}).then(function(paths) {
				console.log(paths)
				paths = map(_.flattenDeep(paths), function (path) {
					return path.replace(`${process.cwd()}/`, '');
				});
				var directoryStructure = new DirectoryStructure(paths);

				_.forEach(directoryStructure.getNodes(), function (node) {
					$scope.files.push({name: node.name}); 
				});
			});
		},
		controllerAs: 'structureCtrl'
	};
}

angular.module('textEditor')
.directive('directoryStructure', DirectoryStructureFactory);