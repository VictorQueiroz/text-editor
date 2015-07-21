var EventEmitter = require('events');

angular.module('textEditor')
.directive('textEditor', function (TextEditor, EditorService) {
	return {
		scope: {
			theme: '=theme'
		},
		link: function (scope, element, attrs) {
			var textEditor = new TextEditor(element);

			EditorService.register('default', textEditor);

			scope.$watch('theme', function (themeName) {
				textEditor.setOption('theme', themeName);
			});

			textEditor.on('change', function () {
				if(!(scope.$$phase || scope.$root.$$phase)) {
					scope.$apply();
				}
			});

			var emitter = new EventEmitter();

			function onMousewheel(evt) {
				emitter.emit('mousewheel', evt.originalEvent);
			}

			const WHEEL_UP 		= -15;
			const WHEEL_DOWN 	= 15;

			emitter.on('mousewheel', function (evt) {
				var fontSize = textEditor.editor.getFontSize();

				if(evt.wheelY === WHEEL_UP) {
					textEditor.setFontSize(fontSize + 1);
				} else if(evt.wheelY === WHEEL_DOWN) {
					textEditor.setFontSize(fontSize <= 12 ? 12 : fontSize - 1);
				}
			});

			function onKeydown (evt) {
				if(evt.keyCode === 17) {
					element.on('mousewheel', onMousewheel);
				}
			}

			element.on('mouseenter', function () {
				element.on('keydown', onKeydown);
			})
			.on('mouseleave', function () {
				element.off('keydown', onKeydown);
				element.off('mousewheel', onMousewheel);
			});
		}
	};
});