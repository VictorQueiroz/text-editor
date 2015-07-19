angular.module('textEditor')
.directive('textEditor', function (TextEditor, EditorService) {
	return {
		scope: {
			theme: '=theme'
		},
		link: function (scope, element, attrs) {
			var textEditor = new TextEditor(element);

			EditorService.setEditor('default', textEditor);

			scope.$watch('theme', function (themeName) {
				textEditor.setOption('theme', themeName);
			});

			textEditor.on('change', function () {
				if(!(scope.$$phase || scope.$root.$$phase)) {
					scope.$apply();
				}
			});
		}
	};
});