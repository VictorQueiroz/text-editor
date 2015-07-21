var _ 						= require('lodash');
var inherits 			= require('../modules/inherits');
var EventEmitter		= require('events');

const CTRL_KEY = 17;

function Shortcut (shortcut) {
	this.shortcut = shortcut;

	this.init();
}

Shortcut.prototype = {
	init: function () {
		this.steps = this.shortcut.split(/\+/);

		_.forEach(this.steps, function (step) {

		});
	},

	shortcuts: {
		ctrl: {
			keyCode: CTRL_KEY,
			eventType: KeyboardEvent
		},
		wheelUp: {
			eventType: MouseEvent
		}
	}
};

inherits(Shortcut, EventEmitter);

angular.module('textEditor')
.factory('Shortcut', function () {
	return Shortcut;
});