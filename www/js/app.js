(function() { 'use strict';var _			= require('lodash');
var curry = _.curry;

function AppController ($scope) {
}
AppController.$inject = ["$scope"];

angular.module('textEditor', [
	'ui.router',
	'ngAnimate'
])
.config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
	$stateProvider
	.state('app', {
		url: '/app',
		templateUrl: 'app.html',
		controller: AppController
	});
	$urlRouterProvider.otherwise('/app/editor');
}]);
var _ 						= require('lodash');
var fs 						= require('../modules/fs');
var util						= require('util');
var some					= _.some;
var first					= _.first;
var filter					= _.filter;
var extend				= _.extend;
var isEmpty				= _.isEmpty;
var isEqual				= _.isEqual;
var isArray				= _.isArray;
var forEach				= _.forEach;
var inherits				= require('../modules/inherits');
var defaults				= _.defaults;
var EditSession 		= ace.require('ace/edit_session').EditSession;
var UndoManager 	= ace.require('ace/undomanager').UndoManager;
var isUndefined		= _.isUndefined;
var EventEmitter		= require('events');

var id = 0;
function getId() {
	id++;
	return id;
}

function PromiseQueue() {
	EventEmitter.call(this);

	this.promiseQueue = [];
	this.promiseQueueErr = [];
}
PromiseQueue.prototype = {
	addErrorPromise: function (promise, err) {
		this.promiseQueueErr.push([promise,err]);
	},

	addPromise: function (promise) {
		var self = this;

		this.emit('promiseAdded');

		this.promiseQueue.push(promise);

		promise.catch(function (err) {
			self.addErrorPromise(promise, err);
		}).finally(function () {
			self.removePromise(promise);
		});

		return promise;
	},

	getPromiseIndex: function (promise) {
		return this.promiseQueue.indexOf(promise);
	},

	removePromise: function (promise) {
		var promiseIndex = this.getPromiseIndex(promise);

		this.promiseQueue.splice(promiseIndex, 1);

		this.emit('promiseRemoved');
	},

	isLoading: function () {
		return this.promiseQueue.length > 0;
	}
};
inherits(PromiseQueue, EventEmitter);

function Tab (file, editorSession) {
	PromiseQueue.call(this);

	this.id = getId();
	this.file = file;
	this.editorSession = editorSession;

	/**
	 * Update the session value
	 * everytime you change your
	 * file content
	 */
	this.on('fileContentUpdated', function () {
		this.editorSession.setValue(this.getFileContent());
	});

	this.updateFileContent();

	this.editorSession.setOption('mode', 'ace/mode/javascript');
}
Tab.prototype = {
	close: function () {
		this.emit('destroy');
		this.editorSession.destroy();
		this.file = undefined;
	},

	getId: function () {
		return this.id;
	},

	hasModifiedContent: function () {
		return !isEqual(this.getFileContent(), this.editorSession.getValue());
	},

	updateContent: function (fileContent) {
		this.file.content = fileContent;

		this.emit('fileContentUpdated');
	},

	updateFileContent: function () {
		var self = this;

		if(!this.file.content) {
			fs.readFile(this.file.path).then((data) => {
				self.updateContent(data.toString());
			});
		}
	},

	saveFile: function () {
		var sessionValue = this.editorSession.getValue();

		this.emit('saving');

		this.updateContent(sessionValue);

		return this.addPromise(fs.writeFile(this.file.path, sessionValue));
	},

	getFileContent: function () {
		return this.file.content;
	},

	compareFile: function (file) {
		return file.path === this.file.path;
	},

	getFile: function() {
		return this.file;
	},

	getEditorSession: function () {
		return this.editorSession;
	}
};
inherits(Tab, PromiseQueue);

function TextEditor(element, options) {
	var self = this;

	EventEmitter.call(this);

	this.element = element;
	this.node = this.element[0];

	this.initAce();

	this.on('saveActualTab', function () {
		var tab = this.getActiveTab();

		this.emit('savingActualTab', tab);

		tab.saveFile().then(function () {
			self.emit('saveActualTabSuccess', tab);
		});
	});

	this.on('tabChanged', function (tab) {
		this.editor.setSession(tab.getEditorSession());
	});

	this.on('optionChanged', function (key, value) {
		this.editor.setOption(key, value);
	});

	this.on('errorUndefinedOption', function (key, value) {
		console.info(`[ERROR] undefined option value (${key}: ${value})`);
	});

	function onKeypress(e) {
		// Ctrl
		if(e.ctrlKey) {
			switch(e.keyCode) {
				// S
				case 19:
					self.emit('saveActualTab');
					break;
			}
		}
	}
	this.on('focus', function () {
		document.addEventListener('keypress', onKeypress);
	});
	this.on('blur', function () {
		document.removeEventListener('keypress', onKeypress);
	});

	this.setOptions(options);

	forEach(TextEditor.defaults, function (defaultValue, key) {
		if(isUndefined(this.options[key])) {
			this.setOption(key, defaultValue);
		}
	}, this);
	this.createTemporaryTab();
}

TextEditor.prototype = {
	options: {
		enableBasicAutocompletion: true
	},

	/**
	 * Events to clone from ACE editor instance
	 * to be reemited by TextEditor constructor
	 */
	events: ['blur', 'focus', 'change', 'changeSession'],

	initAce: function () {
		var self = this;

		this.editor = ace.edit(this.node);

		_.forEach(this.events, function (evtName) {
			this.editor.on(evtName, function (e) {
				self.emit(evtName, e);
			});
		}, this);
	},

	getOption: function (key) {
		return this.editor.getOption(key);
	},

	setFontSize: function (size) {
		this.editor.setFontSize(size);

		return this;
	},

	getValue: function () {
		return this.editor.getValue();
	},

	setOptions: function (options) {
		forEach(options, function (value, key) {
			this.setOption(key, value);
		}, this);
	},

	setOption: function (key, value) {
		if(isUndefined(value)) {
			this.emit('errorUndefinedOption', key, value);
			return;
		}

		this.options[key] = value;

		this.emit('optionChanged', key, value);
		this.emit(`${key}:optionChanged`, value);
	},

	// Tabs

	tabs: [],

	activeTab: 0,

	addTab: function (tab) {
		var self = this;

		this.tabs.push(tab);

		tab.on('saving', function () {
			self.emit('savingTab', tab);
		});

		return tab;
	},

	getTabIndex: function (tab) {
		var tabId = tab.getId();
		var tabIndex = 0;

		forEach(this.tabs, function (tab, index) {
			if(tab.id === tabId) {
				tabIndex = index;
			}
		});

		return tabIndex;
	},

	createTemporaryTab: function () {
		var file = {
			content: getId(),
			name: 'untitled',
			path: getId()
		};

		var session = new EditSession('type me out');
		session.setUndoManager(new UndoManager());
		var tab = new Tab(file, session);
		this.addTab(tab);
		this.setTabActive(tab);
	},

	removeTab: function (tab) {
		if(tab.hasModifiedContent() &&
			!(confirm('Are you sure you want to close this tab?'))) {
			return;
		}

		var oldTabIndex = this.getTabIndex(tab);
		this.tabs.splice(oldTabIndex, 1);
		tab = undefined;

		if(isEmpty(this.tabs)) {
			this.createTemporaryTab();
			return;
		}

		if((oldTabIndex - 1) < 0) {
			this.setTabActive(first(this.tabs));
		} else if (oldTabIndex - 1 > this.tabs.length - 1) {
			this.setTabActive(this.tabs[this.tabs.length - 1]);
		} else {
			this.setTabActive(first(this.tabs));
		}
	},

	getTabById: function (tabId) {
		return first(filter(this.tabs, function (tab) {
			return tab.getId() === tabId;
		}));
	},

	setTabActive: function (tabId) {
		var tab;

		if(tabId instanceof Tab) {
			tab = tabId;
			tabId = tab.getId();
		} else {
			tab = this.getTabById(tabId);
		}

		if(this.activeTab === tabId) {
			this.emit('errorAlreadyActiveTabReactivation');
			return;
		}

		var tab = this.getTabById(tabId);
		
		if(!tab) {
			throw new Error(`there is not tab with id ${tabId}`);
		}

		this.activeTab = tab.id;
		this.emit('tabChanged', tab);
	},

	getActiveTab: function () {
		return this.getTabById(this.activeTab);
	},

	getTabByFile: function (file) {
		return first(filter(this.tabs, function (tab) {
			return tab && tab.compareFile(file);
		}));
	},

	tabExists: function (file) {
		return some(this.tabs, function (tab) {
			return tab && tab.compareFile(file);
		});
	},

	checkFileValidity: function (path) {
		var deferred = Q.defer();

		fs.exists(path).then(function () {
			return fs.stat(path).then(function (stat) {
				if(stat.isFile()) {
					deferred.resolve();
				} else {
					deferred.reject();
				}
			});
		});

		return deferred.promise;
	},

	modes: {
		js: {
			aliases: ['js'],
			name: 'javascript'
		}
	},

	getModeFromFile: function (file) {
		var mode = require('path').extname(file).replace(/^\./, '');

		// Check for alias
		forEach(this.modes, function (value) {
			if(value.aliases.indexOf(mode) > -1) {
				mode = value.name;
			}
		}, this);

		return mode;
	},

	readFile: function (file) {
		var self = this;

		return this.checkFileValidity(file.path).then(() => {
			if(self.tabExists(file)) {
				self.setTabActive(self.getTabByFile(file).id);
				return;
			}

			var session = new EditSession('');
			session.setUndoManager(new UndoManager());

			var mode = self.getModeFromFile(file.path);

			if(mode) {
				session.setMode(mode);
			}

			var tab = self.addTab(new Tab(file, session));
			self.setTabActive(tab);

			tab.once('destroy', function () {
				self.removeTab(tab);
			});
		}, function (err) {
			console.log(err);
		});
	},

	getTabs: function () {
		return this.tabs;
	}
};

extend(TextEditor.prototype, EventEmitter.prototype);

TextEditor.defaults = {
	theme: 'ace/styles/github',
	mode: 'ace/mode/javascript'
};

function TextEditorFactory () {
	return TextEditor;
}

function EditorServiceFactory($q) {
	function EditorService () {
		EventEmitter.call(this);

		this.registry = {};
	}
	EditorService.prototype = {
		register: function (key, value) {
			this.registry[key] = value;

			this.emit('editorRegistered', key);
			this.emit(`${key}:editorRegistered`, value);

			return this;
		},

		getEditor: function (key) {
			var self = this;

			var editor = this.registry[key];

			if(isUndefined(editor)) {
				return $q(function (resolve, reject) {
					self.on(`${key}:editorRegistered`, function (editor) {
						resolve(editor);
					});
				});
			}

			return editor;
		}
	};
	extend(EditorService.prototype, EventEmitter.prototype);

	return new EditorService();
}
EditorServiceFactory.$inject = ["$q"];

angular.module('textEditor')
.factory('EditorService', EditorServiceFactory)
.factory('TextEditor', TextEditorFactory);
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
angular.module('textEditor')
.factory('$process', ["$window", function ($window) {
	return $window.process;
}]);
function $HelpersFactory($timeout) {
	return {
		digest: curry(function (scope, fn) {
			if(scope.$$phase || scope.$root.$$phase) {
				fn(scope);
			} else {
				scope.$apply(fn);
			}
		})
	};
}
$HelpersFactory.$inject = ["$timeout"];

angular.module('textEditor')
.factory('$helpers', $HelpersFactory);
var _						= require('lodash');
var Q 					= require('q');
var fs 					= require('../modules/fs');
var map					= _.map;
var path 				= require('path');
var glob					= require('../modules/glob');
var Node 				= require('../modules/node-element');
var first				= _.first;
var filter				= _.filter;
var forEach			= _.forEach;
var flattenDeep	= _.flattenDeep;
var isUndefined	= _.isUndefined;

function DirectoryStructure(paths) {
	this.paths = paths;
	this.nodes = [];

	forEach(this.paths, function (segments) {
		segments = segments.split('/');

		var nodeName = first(segments);	
		var parentNode = this.getNode(nodeName) ||
											new Node(nodeName);

		this.addNode(this.createNodes(segments, parentNode, 1));
	}, this);
}
DirectoryStructure.getStructure = function () {
	return fs.readdir(process.cwd()).then(function (files) {
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
		paths = map(flattenDeep(paths), function (path) {
			return path.replace(`${process.cwd()}/`, '');
		});

		return new DirectoryStructure(paths);
	});
};
DirectoryStructure.prototype = {
	addNode: function (node) {
		if(this.getNode(node.name)) {
			return true;
		} else {
			this.nodes.push(node);
		}
	},
	getElements: function () {
		var container = angular.element('<ul>');

		forEach(this.nodes, function (node) {
			container.append(node.getElement());
		});

		return container;
	},
	getNode: function (name) {	
		return first(filter(this.nodes, function (node) {
			return node.compareName(name);
		}));
	},
	getNodes: function () {
		return this.nodes;
	},
	createNodes: function (segments, parentNode, depth) {
		forEach(segments.slice(depth, depth + 1), function (segment, index) {
			var childNode = parentNode.getChildByName(segment) || new Node(segment);

			// If the parent node doesn't have the actual
			// children node, add to his list 
			if(!parentNode.hasChild(childNode)) {
				parentNode.addChild(childNode);
			}

			// Now we load the next segments, notice that
			// now the parent node will be our childNode
			// and we will have one more depth level
			this.createNodes(segments, childNode, depth + 1);
		}, this);

		return parentNode;
	}
};

angular.module('textEditor')
.factory('DirectoryStructure', function () {
	return DirectoryStructure;
});
var EventEmitter = require('events');

angular.module('textEditor')
.directive('textEditor', ["TextEditor", "EditorService", function (TextEditor, EditorService) {
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
}]);
angular.module('textEditor')
.directive('tabsList', ["EditorService", function (EditorService) {
	return {
		restrict: 'E',
		controller: ["$scope", "$element", "$attrs", function ($scope, $element, $attrs) {
			var defaultEditor = EditorService.getEditor('default');

			defaultEditor.on('savingTab', function (tab) {
				$scope.$apply();
			});

			$scope.tabs = defaultEditor.tabs;
			$scope.setTabActive = function (tab) {
				defaultEditor.setTabActive(tab);
			};

			$scope.isActive = function (tab) {
				var activeTab = defaultEditor.getActiveTab();

				return activeTab && activeTab.id === tab.id;
			};
		}],
		templateUrl: 'app-editor/tabs-list.html'
	};
}])
function DirectoryStructureFactory ($process, $compile, EditorService, DirectoryStructure) {
	return {
		scope: {
			nodes: '=nodes'
		},
		controller: ["$scope", "$element", "$attrs", function ($scope, $element, $attrs) {
			var cwd = $process.cwd();

			var defaultEditor;
			var editorPromise = EditorService.getEditor('default').then(function (editor) {
				defaultEditor = editor;

				return editor;
			});

			this.readFile = function (file) {
				var fileName = file.match(/([^\/]+)$/)[1];

				editorPromise.then(function (editor) {
					editor.readFile({ path: file, name: fileName });
				});
			};

			this.isActive = function (file) {
				var activeTab = defaultEditor.getActiveTab();
				return activeTab && activeTab.compareFile(file);
			};

			DirectoryStructure.getStructure().then(function (directoryStructure) {
				var nodes = directoryStructure.getElements();

				nodes.addClass('files-list');

				$compile(nodes)($scope);

				$element.append(nodes);
			}, function (err) {
				console.log(err);
			});
		}],
		controllerAs: 'structureCtrl'
	};
}
DirectoryStructureFactory.$inject = ["$process", "$compile", "EditorService", "DirectoryStructure"];

angular.module('textEditor')
.directive('nodeHasChildren', ["$animate", "$helpers", function ($animate, $helpers) {
	function postLink (scope, element, attrs) {
		var apply = $helpers.digest(scope);

		function addClass(addClass) {
			removeClass(false);
		}

		function removeClass(rly) {
			apply(function () {
				$animate[rly === false && 'addClass' ||
				_.isUndefined(rly) && 'removeClass'](element, 'opened')
			});
		}

		element.on('click', function (event) {
			var targetEl 	= event.target;
			var tagName 	= targetEl.tagName;

			if(!((targetEl.tagName === 'A') &&
				targetEl.parentNode === element[0])) {
				return;
			}

			var hasClass = element.hasClass('opened');

			if(hasClass) {
				removeClass();
			} else {
				addClass();
			}
		});
	}

	return {
		compile: function (element, attrs) {
			element
			.children('a')
			.append('<i class="chevron">');

			element
			.children('a')
			.append('<i class="folder">');

			return postLink;
		}
	};
}])
.directive('nodeIsFile', function () {
	return function (scope, element, attrs) {
		element.children('a').append('<i class="file">')
	};
})
.directive('directoryStructure', DirectoryStructureFactory);
function EditorController($scope) {
}
EditorController.$inject = ["$scope"];

angular.module('textEditor')
.config(["$stateProvider", function ($stateProvider) {
	$stateProvider
	.state('app.editor', {
		url: '/editor',
		templateUrl: 'app-editor/app-editor.html',
		controller: EditorController,
		controllerAs: 'editorCtrl'
	});
}]);}());