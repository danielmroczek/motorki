export default class {
    constructor() {
        this.listeners = {};
    }

    addEventListener(event, callback) {
        if (!event || typeof callback !== "function" ) {
            return;
        }

        let eventListeners = this.listeners[event];
        if (!eventListeners) {
            eventListeners = [];
            this.listeners[event] = eventListeners;
        }

        eventListeners.push(callback);
    }

    emit(event, data) {
        let eventListeners = this.listeners[event];
        if (!eventListeners) {
            return;
        }

        eventListeners.forEach(listener => {
            listener.call(this, data);
        });
    }
}