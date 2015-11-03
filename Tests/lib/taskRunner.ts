/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import events = require('events');

export class TaskRunner extends events.EventEmitter {
	
	public run(): Q.Promise<void> {
		this.emit('starting');
		var defer = Q.defer<void>();
		
		setTimeout(() => {
			this.emit('completed');
			defer.resolve(null);				
		}, 1000);
		
		return <Q.Promise<void>>defer.promise;
	}
}

