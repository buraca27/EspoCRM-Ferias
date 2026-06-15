define('custom:views/periodo-ferias/fields/date-start-date', ['views/fields/date'], function (Dep) {

    return Dep.extend({

        getStartDateForDatePicker: function () {
            var now = new Date();
            var pad = function (n) { return ('0' + n).slice(-2); };
            var todayIso = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

            return this.getDateTime().toDisplayDate(todayIso);
        },

        validate: function () {
            var result = Dep.prototype.validate.call(this);

            if (result) {
                return result;
            }

            if (this.mode !== 'edit' && this.mode !== 'inlineEdit') {
                return false;
            }

            var value = this.model.get(this.name);

            if (!value) {
                return false;
            }

            var now = new Date();
            var pad = function (n) { return ('0' + n).slice(-2); };
            var todayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

            if (value < todayStr) {
                this.showValidationMessage('Não é possível marcar férias no passado.');
                return true;
            }

            return false;
        }
    });
});
