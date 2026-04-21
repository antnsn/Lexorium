const DEBUG = {
    enabled: false,
    log: function(...args) {
        if (this.enabled) {
            console.log(...args);
        }
    },
    error: function(...args) {
        if (this.enabled) {
            console.error(...args);
        }
    }
};

module.exports = { DEBUG };
