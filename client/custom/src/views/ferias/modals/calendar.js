define('custom:views/ferias/modals/calendar', ['views/modal'], function (Dep) {

    return Dep.extend({

        backdrop: true,

        templateContent: '<div class="ferias-cal-wrap" style="text-align:left;">A carregar…</div>',

        monthNames: [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ],

        weekDays: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],

        setup: function () {
            this.year      = this.options.year || (new Date()).getFullYear();
            this.periods   = this.options.periods || [];
            this.feriasId  = this.options.feriasId || null;
            this.feriasName = this.options.feriasName || null;

            this._selStart = null; // first clicked day (selection)

            this.headerText = 'Calendário ' + this.year;

            this.buttonList = [{ name: 'cancel', label: 'Fechar' }];
            this.fitHeight = true;
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            this.injectResponsiveCss();

            try {
                this.renderCalendar();
            } catch (e) {
                console.error('Calendar render error', e);
            }
        },

        injectResponsiveCss: function () {
            if (document.getElementById('ferias-cal-responsive-css')) {
                return;
            }

            var css = '@media screen and (max-width: 900px) {' +
                '.ferias-cal-month { width: 48% !important; }' +
                '}' +
                '@media screen and (max-width: 650px) {' +
                '.modal { left: 0 !important; right: 0 !important; margin: 0 auto !important; }' +
                '.modal-dialog { margin: 10px auto !important; width: auto !important; max-width: 100% !important; }' +
                '.ferias-cal-wrap { padding: 0 10px !important; }' +
                '.ferias-cal-month { width: 100% !important; margin: 0 0 8px 0 !important; padding: 10px !important; }' +
                '.ferias-cal-month > div:first-child { font-size: 14px !important; margin-bottom: 6px !important; }' +
                '.ferias-cal-month .ferias-weekdays { font-size: 9px !important; margin-bottom: 3px !important; }' +
                '.ferias-cal-month .ferias-days { font-size: 11px !important; gap: 1px !important; }' +
                '.ferias-cal-month .ferias-days > div { padding: 4px 0 !important; }' +
                '}';

            var style = document.createElement('style');
            style.id = 'ferias-cal-responsive-css';
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        },

        parseDate: function (value) {
            if (!value) {
                return null;
            }

            var p = String(value).substring(0, 10).split('-');

            if (p.length !== 3) {
                return null;
            }

            var y = parseInt(p[0], 10);
            var m = parseInt(p[1], 10);
            var d = parseInt(p[2], 10);

            if (isNaN(y) || isNaN(m) || isNaN(d)) {
                return null;
            }

            return new Date(y, m - 1, d);
        },

        getStatusColor: function (item) {
            var c = item.aprovacaoChefia;
            var d = item.aprovadirecao;
            var isTransitado = (item.tipoDias === 'Ano Anterior');

            if (c === 'Recusado' || d === 'Recusado') {
                return '#e74c3c';
            }

            if (c === 'Aprovado' && d === 'Aprovado') {
                return isTransitado ? '#3498db' : '#2ecc8f';
            }

            return isTransitado ? '#9b59b6' : '#f39c12';
        },

        padDate: function (n) { return ('0' + n).slice(-2); },

        buildDaySet: function () {
            var set = {};
            this.dayToPeriod = {};
            this.dayToColor = {};

            this.periods.forEach(function (item) {
                var s = this.parseDate(item.dateStart || item.dateStartDate);
                var e = this.parseDate(item.dateEnd || item.dateEndDate);

                if (!s || !e) {
                    return;
                }

                var color = this.getStatusColor(item);
                var cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());

                while (cur <= e) {
                    var key = cur.getFullYear() + '-' + this.padDate(cur.getMonth() + 1) + '-' + this.padDate(cur.getDate());
                    set[key] = true;
                    this.dayToPeriod[key] = item;
                    this.dayToColor[key] = color;
                    cur.setDate(cur.getDate() + 1);
                }
            }, this);

            return set;
        },

        monthHtml: function (monthIndex, daySet) {
            var year = this.year;
            var first = new Date(year, monthIndex, 1);
            var startWeekday = (first.getDay() + 6) % 7; // Monday = 0
            var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

            var html = '<div class="ferias-cal-month" style="display:inline-block;vertical-align:top;width:31%;min-width:200px;' +
                'margin:0 1% 18px 1%;border:1px solid #e2e2e2;border-radius:6px;padding:12px;">';

            html += '<div class="ferias-cal-title" style="text-align:center;font-weight:600;color:#333;margin-bottom:8px;">' +
                this.monthNames[monthIndex] + '</div>';

            // Weekday headers
            html += '<div class="ferias-weekdays" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;' +
                'font-size:10px;color:#999;text-align:center;margin-bottom:4px;">';

            this.weekDays.forEach(function (w) {
                html += '<div>' + w + '</div>';
            });

            html += '</div>';

            // Days grid
            html += '<div class="ferias-days" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;' +
                'font-size:12px;text-align:center;">';

            for (var i = 0; i < startWeekday; i++) {
                html += '<div></div>';
            }

            var now = new Date();
            var pad = function (n) { return ('0' + n).slice(-2); };
            var todayKey = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

            for (var d = 1; d <= daysInMonth; d++) {
                var key = year + '-' + pad(monthIndex + 1) + '-' + pad(d);
                var weekday = (startWeekday + d - 1) % 7;
                var isWeekend = (weekday === 5 || weekday === 6);
                var isToday = (key === todayKey);
                var isPast = (key < todayKey);

                var cellStyle = 'padding:5px 0;border-radius:3px;position:relative;';

                var isFree = !daySet[key];
                var canCreate = this.feriasId && isFree && !isWeekend && !isPast;

                if (daySet[key]) {
                    var color = this.dayToColor[key] || '#2ecc8f';
                    cellStyle += 'background:' + color + ';color:#fff;font-weight:600;cursor:pointer;transition:background .1s;';
                } else if (isWeekend) {
                    cellStyle += 'background:#f5f5f5;color:#bbb;';
                } else if (isPast) {
                    cellStyle += 'color:#ccc;';
                } else {
                    cellStyle += 'color:#555;' + (canCreate ? 'cursor:pointer;' : '');
                }

                if (isToday) {
                    cellStyle += 'outline:2px solid #e74c3c;outline-offset:-1px;font-weight:700;';
                }

                html += '<div class="ferias-cal-day" data-key="' + key + '" data-free="' + (isFree ? '1' : '0') + '" ' +
                    'data-weekend="' + (isWeekend ? '1' : '0') + '" data-past="' + (isPast ? '1' : '0') + '" style="' + cellStyle + '">' + d + '</div>';
            }

            html += '</div></div>';

            return html;
        },

        renderCalendar: function () {
            var daySet = this.buildDaySet();

            // Days marked in the currently displayed year
            var prefix = this.year + '-';
            var totalThisYear = Object.keys(daySet).filter(function (k) {
                return k.indexOf(prefix) === 0;
            }).length;

            // Year navigator
            var nav = '<div style="display:flex;align-items:center;justify-content:center;' +
                'gap:22px;margin-bottom:16px;">' +
                '<span class="ferias-cal-prev" title="Ano anterior" ' +
                'style="cursor:pointer;font-size:16px;color:#4a90d9;padding:4px 12px;' +
                'border:1px solid #d8e2ee;border-radius:5px;">&#9664;</span>' +
                '<span style="font-size:20px;font-weight:600;color:#333;min-width:70px;' +
                'text-align:center;">' + this.year + '</span>' +
                '<span class="ferias-cal-next" title="Ano seguinte" ' +
                'style="cursor:pointer;font-size:16px;color:#4a90d9;padding:4px 12px;' +
                'border:1px solid #d8e2ee;border-radius:5px;">&#9654;</span>' +
                '</div>';

            var selHint = this.feriasId
                ? '<div class="ferias-cal-sel-hint" style="text-align:center;font-size:12px;color:#4a90d9;' +
                  'margin-bottom:10px;min-height:18px;">' +
                  'Clica num dia livre para iniciar agendamento</div>'
                : '';

            var legend = '<div style="margin-bottom:10px;font-size:12px;color:#666;' +
                'display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;">' +
                '<span><b>' + totalThisYear + '</b> dias em ' + this.year + '</span>' +
                '<span style="width:1px;height:14px;background:#ddd;"></span>' +
                '<span style="display:flex;align-items:center;gap:4px;">' +
                '<span style="display:inline-block;width:11px;height:11px;background:#2ecc8f;border-radius:2px;"></span>Aprovado</span>' +
                '<span style="display:flex;align-items:center;gap:4px;">' +
                '<span style="display:inline-block;width:11px;height:11px;background:#f39c12;border-radius:2px;"></span>Pendente</span>' +
                '<span style="display:flex;align-items:center;gap:4px;">' +
                '<span style="display:inline-block;width:11px;height:11px;background:#e74c3c;border-radius:2px;"></span>Recusado</span>' +
                '<span style="display:flex;align-items:center;gap:4px;">' +
                '<span style="display:inline-block;width:11px;height:11px;background:#3498db;border-radius:2px;"></span>Transitado</span>' +
                '<span style="display:flex;align-items:center;gap:4px;">' +
                '<span style="display:inline-block;width:11px;height:11px;border:2px solid #e74c3c;border-radius:3px;"></span>Hoje</span>' +
                (this.feriasId
                    ? '<span style="display:flex;align-items:center;gap:4px;">' +
                      '<span style="display:inline-block;width:11px;height:11px;background:#e8f4fd;border:1px dashed #4a90d9;border-radius:3px;"></span>Livre (clicável)</span>'
                    : '') +
                '</div>';

            var monthsHtml = '<div style="text-align:left;">';

            for (var m = 0; m < 12; m++) {
                monthsHtml += this.monthHtml(m, daySet);
            }

            monthsHtml += '</div>';

            this.$el.find('.ferias-cal-wrap').html(nav + selHint + legend + monthsHtml);

            this.$el.find('.ferias-cal-prev').on('click', function () {
                this.year = this.year - 1;
                this._selStart = null;
                this.renderCalendar();
            }.bind(this));

            this.$el.find('.ferias-cal-next').on('click', function () {
                this.year = this.year + 1;
                this._selStart = null;
                this.renderCalendar();
            }.bind(this));

            // Day click handler — range selection or open existing period
            this.$el.find('.ferias-cal-day').on('click', function (e) {
                var $cell = $(e.currentTarget);
                var key = $cell.attr('data-key');
                var isFree = $cell.attr('data-free') === '1';
                var isWeekend = $cell.attr('data-weekend') === '1';
                var period = this.dayToPeriod[key];

                // Click on existing period → open it
                if (period && period.id) {
                    this.openPeriod(period.id);
                    return;
                }

                // Click on free weekday when feriasId is set → range selection
                var isPast = $cell.attr('data-past') === '1';
                if (this.feriasId && isFree && !isWeekend && !isPast) {
                    if (!this._selStart) {
                        // First click — store start, highlight cell
                        this._selStart = key;
                        this.$el.find('.ferias-cal-sel-start').removeClass('ferias-cal-sel-start')
                            .css({'outline': '', 'outline-offset': ''});
                        $cell.addClass('ferias-cal-sel-start')
                            .css({'outline': '2px solid #4a90d9', 'outline-offset': '-1px'});
                        this.$el.find('.ferias-cal-sel-hint').html(
                            'Início: <b>' + key + '</b> — clica num dia para terminar o período'
                        );
                    } else {
                        // Second click — open create modal
                        var start = this._selStart;
                        var end = key;

                        if (start > end) {
                            var tmp = start;
                            start = end;
                            end = tmp;
                        }

                        this._selStart = null;
                        this.$el.find('.ferias-cal-sel-start').removeClass('ferias-cal-sel-start')
                            .css({'outline': '', 'outline-offset': ''});
                        this.$el.find('.ferias-cal-sel-hint').html(
                            'Clica num dia livre para iniciar agendamento'
                        );

                        this.openCreatePeriod(start, end);
                    }
                }
            }.bind(this));
        },

        openCreatePeriod: function (dateStart, dateEnd) {
            var self = this;

            require(['views/modals/edit'], function (EditModal) {
                var attributes = {
                    feriasId: self.feriasId,
                    feriasName: self.feriasName,
                    dateStartDate: dateStart,
                    dateEndDate: dateEnd,
                    dateStart: dateStart + ' 00:00:00',
                    dateEnd: dateEnd + ' 23:59:59'
                };

                self.createView('createPeriod', 'views/modals/edit', {
                    scope: 'PeriodoFerias',
                    attributes: attributes
                }, function (view) {
                    view.render();

                    self.listenToOnce(view, 'after:save', function (model) {
                        view.close();
                        self.trigger('period:created', model);
                        // Reload calendar with fresh data
                        self._reloadAndRender();
                    });
                });
            });
        },

        _reloadAndRender: function () {
            if (!this.feriasId) {
                this.renderCalendar();
                return;
            }

            var self = this;
            var year = this.year;

            Espo.Ajax.getRequest('PeriodoFerias', {
                maxSize: 200,
                select: 'id,dateStart,dateEnd,dateStartDate,dateEndDate,aprovacaoChefia,aprovadirecao,diasmarcados,tipoDias',
                'where[0][type]': 'equals',
                'where[0][field]': 'feriasId',
                'where[0][value]': this.feriasId
            }).then(function (data) {
                self.periods = (data && data.list) ? data.list : [];
                self.renderCalendar();
            }).catch(function () {
                self.renderCalendar();
            });
        },

        openPeriod: function (periodId) {
            if (!periodId) {
                return;
            }

            this.close();

            setTimeout(function () {
                this.getRouter().navigate('PeriodoFerias/view/' + periodId, {trigger: true});
            }.bind(this), 200);
        }
    });
});
