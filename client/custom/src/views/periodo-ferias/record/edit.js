define('custom:views/periodo-ferias/record/edit', ['views/record/edit'], function (Dep) {

    return Dep.extend({

        validate: function () {
            var dateStartDate = this.model.get('dateStartDate');

            if (dateStartDate) {
                var pad = function (n) { return ('0' + n).slice(-2); };
                var now = new Date();
                var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

                if (dateStartDate < today) {
                    Espo.Ui.error('Não é possível marcar férias no passado.');
                    return true;
                }
            }

            return Dep.prototype.validate.call(this);
        }
    });
});
