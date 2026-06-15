define('custom:views/ferias/fields/timeline', ['views/fields/base'], function (Dep) {

    return Dep.extend({

        // Inline container — filled in afterRender (avoids external template/css loading)
        templateContent: '<div class="ferias-timeline-root" style="width:100%;">' +
            '<div class="ferias-timeline-body" style="color:#888;font-size:12px;">...</div>' +
            '</div>',

        monthsPt: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],

        setup: function () {
            Dep.prototype.setup.call(this);
            this.once('after:render', function () {
                // Delay so relationship panels finish loading
                setTimeout(this._attachCollectionListener.bind(this), 800);
            });
        },

        // Recursively search _views (Bullbone internal) for the periodoFerias panel
        _findPanel: function (view) {
            if (!view) return null;
            if ((view.link === 'periodoFerias' || view.scope === 'PeriodoFerias') && view.collection) {
                return view;
            }
            var internalViews = view._views || {};
            var keys = Object.keys(internalViews);
            for (var i = 0; i < keys.length; i++) {
                var found = this._findPanel(internalViews[keys[i]]);
                if (found) return found;
            }
            return null;
        },

        // Walk UP to the highest reachable ancestor, then search DOWN
        _getRootView: function () {
            var v = this;
            var limit = 10;
            while (v.getParentView && v.getParentView() && limit-- > 0) {
                v = v.getParentView();
            }
            return v;
        },

        _attachCollectionListener: function () {
            var self = this;
            var attempt = 0;

            var tryAttach = function () {
                var panel = self._findPanel(self._getRootView());
                if (panel) {
                    self.stopListening(panel.collection, 'sync');
                    self.listenTo(panel.collection, 'sync', function () {
                        self._reloadData();
                    });
                    return;
                }
                if (++attempt < 12) {
                    setTimeout(tryAttach, 500);
                }
            };

            tryAttach();
        },

        _reloadData: function () {
            var id = this.model.id;
            if (!id || !this.isRendered()) return;

            var self = this;

            this.model.fetch().then(function () {
                return Espo.Ajax.getRequest('PeriodoFerias', {
                    maxSize: 200,
                    select: 'id,dateStart,dateEnd,dateStartDate,dateEndDate,aprovacaoChefia,aprovadirecao,conferidoDAF,diasmarcados,tipoDias',
                    'where[0][type]': 'equals',
                    'where[0][field]': 'feriasId',
                    'where[0][value]': id
                });
            }).then(function (data) {
                if (!self.isRendered()) return;
                try {
                    self.build((data && data.list) ? data.list : []);
                } catch (e) {
                    console.error('Timeline reload error', e);
                }
            });
        },

        injectResponsiveCss: function () {
            if (document.getElementById('ferias-tl-responsive-css')) {
                return;
            }

            var css = '@media screen and (max-width: 900px) {' +
                '.ferias-timeline-body { font-size: 11px !important; }' +
                '.ferias-tl-bar { height: 22px !important; }' +
                '}' +
                '@media screen and (max-width: 600px) {' +
                '.ferias-timeline-body { font-size: 10px !important; }' +
                '.ferias-tl-bar { height: 18px !important; }' +
                '}';

            var style = document.createElement('style');
            style.id = 'ferias-tl-responsive-css';
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            this.injectResponsiveCss();

            // Render in detail and list modes (skip edit/search)
            if (this.mode === 'edit' || this.mode === 'search') {
                return;
            }

            var id = this.model.id;

            if (!id) {
                return;
            }

            Espo.Ajax.getRequest('PeriodoFerias', {
                maxSize: 200,
                select: 'id,dateStart,dateEnd,dateStartDate,dateEndDate,aprovacaoChefia,aprovadirecao,conferidoDAF,diasmarcados,tipoDias',
                'where[0][type]': 'equals',
                'where[0][field]': 'feriasId',
                'where[0][value]': id
            })
                .then(function (data) {
                    try {
                        this.build((data && data.list) ? data.list : []);
                    } catch (e) {
                        console.error('Timeline build error', e);
                    }
                }.bind(this))
                .catch(function () {
                    this.$el.find('.ferias-timeline-body').html(
                        '<span style="color:#c0392b;">Erro ao carregar períodos.</span>'
                    );
                }.bind(this));
        },

        parseDate: function (value) {
            if (!value) {
                return null;
            }

            var datePart = String(value).substring(0, 10);
            var p = datePart.split('-');

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

        dayOfYear: function (date) {
            var start = new Date(date.getFullYear(), 0, 0);
            var diff = date - start;

            return Math.floor(diff / 86400000);
        },

        formatDM: function (date) {
            if (!date) {
                return '?';
            }

            var d = ('0' + date.getDate()).slice(-2);
            var m = ('0' + (date.getMonth() + 1)).slice(-2);

            return d + '/' + m;
        },

        escapeHtml: function (str) {
            if (str === null || str === undefined) {
                return '';
            }

            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        },

        build: function (list) {
            var year = this.model.get('ano');

            if (!year && list.length) {
                var firstDate = this.parseDate(list[0].dateStart || list[0].dateStartDate);
                year = firstDate ? firstDate.getFullYear() : (new Date()).getFullYear();
            }

            if (!year) {
                year = (new Date()).getFullYear();
            }

            // Store for the full-calendar modal
            this.periodsList = list;
            this.calYear = year;

            var totalDays = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;

            var yearStart = new Date(year, 0, 1);
            var yearEnd = new Date(year, 11, 31);

            var compact = (this.mode === 'list' || this.mode === 'listLink' || this.mode === 'listSmall');
            var barH = compact ? 16 : 28;
            var labelSize = compact ? 8 : 10;
            var labelMargin = compact ? 1 : 3;

            // Month labels
            var labelsHtml = '<div style="display:flex;font-size:' + labelSize +
                'px;color:#999;margin-bottom:' + labelMargin + 'px;">';

            this.monthsPt.forEach(function (m) {
                labelsHtml += '<div style="flex:1;text-align:left;padding-left:2px;">' + m + '</div>';
            });

            labelsHtml += '</div>';

            // Bar (wrapper is relative so the tooltip can be positioned over it)
            var barHtml = '<div class="ferias-tl-wrap" style="position:relative;">';

            barHtml += '<div class="ferias-tl-bar" style="position:relative;height:' + barH +
                'px;background:#f0f0f0;border-radius:3px;overflow:visible;border:1px solid #e2e2e2;">';

            for (var i = 1; i < 12; i++) {
                var leftPct = (i / 12) * 100;
                barHtml += '<div style="position:absolute;top:0;bottom:0;left:' + leftPct +
                    '%;width:1px;background:#e0e0e0;"></div>';
            }

            var markedDays = 0;

            list.forEach(function (item) {
                var s = this.parseDate(item.dateStart || item.dateStartDate);
                var e = this.parseDate(item.dateEnd || item.dateEndDate);

                if (!s || !e) {
                    return;
                }

                if (e < yearStart || s > yearEnd) {
                    return;
                }

                if (s < yearStart) {
                    s = yearStart;
                }

                if (e > yearEnd) {
                    e = yearEnd;
                }

                var sd = this.dayOfYear(s);
                var ed = this.dayOfYear(e);

                if (ed < sd) {
                    ed = sd;
                }

                var spanDays = (ed - sd) + 1;
                markedDays += spanDays;

                var left = ((sd - 1) / totalDays) * 100;
                var width = (spanDays / totalDays) * 100;

                if (width < 0.6) {
                    width = 0.6;
                }

                // Tooltip data carried on the segment
                var dRange = this.formatDM(s) + ' → ' + this.formatDM(e);
                var chefia = item.aprovacaoChefia || '';
                var direcao = item.aprovadirecao || '';
                var daf = item.conferidoDAF || '—';
                var tipo = item.tipoDias || 'Ano Atual';
                var isTransitado = (tipo === 'Ano Anterior');

                // Color by approval status + tipo de dias
                // Ano Atual:    verde=#2ecc8f  laranja=#f39c12  vermelho=#e74c3c
                // Ano Anterior: azul=#3498db   roxo=#9b59b6     vermelho=#e74c3c
                var segColor;
                if (chefia === 'Recusado' || direcao === 'Recusado') {
                    segColor = '#e74c3c';
                } else if (chefia === 'Pendente' || direcao === 'Pendente') {
                    segColor = isTransitado ? '#9b59b6' : '#f39c12';
                } else {
                    segColor = isTransitado ? '#3498db' : '#2ecc8f';
                }

                barHtml += '<div class="ferias-tl-seg" ' +
                    'data-range="' + dRange + '" ' +
                    'data-chefia="' + this.escapeHtml(chefia || '—') + '" ' +
                    'data-direcao="' + this.escapeHtml(direcao || '—') + '" ' +
                    'data-daf="' + this.escapeHtml(daf) + '" ' +
                    'data-tipo="' + this.escapeHtml(tipo) + '" ' +
                    'data-center="' + (left + width / 2) + '" ' +
                    'style="position:absolute;top:3px;bottom:3px;left:' + left + '%;width:' + width + '%;' +
                    'background:' + segColor + ';border-radius:2px;cursor:pointer;' +
                    'box-shadow:0 1px 2px rgba(0,0,0,0.15);transition:background .15s;"></div>';
            }, this);

            // Today marker
            var today = new Date();
            if (today.getFullYear() === year) {
                var todayDoy = this.dayOfYear(today);
                var todayLeft = ((todayDoy - 1) / totalDays) * 100;
                barHtml += '<div title="Hoje" style="position:absolute;top:-3px;bottom:-3px;left:' + todayLeft +
                    '%;width:2px;background:#e74c3c;z-index:2;border-radius:1px;"></div>';
                barHtml += '<div style="position:absolute;top:-8px;left:' + todayLeft +
                    '%;transform:translateX(-50%);width:6px;height:6px;background:#e74c3c;border-radius:50%;z-index:2;"></div>';
            }

            barHtml += '</div>'; // .ferias-tl-bar

            // Tooltip element (hidden by default)
            barHtml += '<div class="ferias-tl-tip" style="display:none;position:absolute;z-index:1000;' +
                'bottom:100%;margin-bottom:9px;transform:translateX(-50%);background:#2b2f33;color:#fff;' +
                'padding:8px 11px;border-radius:6px;font-size:12px;line-height:1.5;white-space:nowrap;' +
                'box-shadow:0 4px 14px rgba(0,0,0,0.3);pointer-events:none;">' +
                '<div class="ferias-tl-tip-content"></div>' +
                '<div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);' +
                'border:6px solid transparent;border-top-color:#2b2f33;"></div>' +
                '</div>';

            barHtml += '</div>'; // .ferias-tl-wrap

            // Legend (only in detail mode)
            var legendHtml = '';

            if (!compact) {
                var diasFeriasAno        = this.model.get('diasFeriasAno') || 0;
                var diasTransitados      = this.model.get('diasTransitados') || 0;
                var diasAnoAtualUsados   = this.model.get('diasAnoAtualUsados') || 0;
                var diasTransUsados      = this.model.get('diasTransitadosUsados') || 0;
                var dataLimite           = this.model.get('dataLimiteTransitados');

                var anoRestantes         = diasFeriasAno - diasAnoAtualUsados;
                var transRestantes       = diasTransitados - diasTransUsados;
                var totalDisponiveis     = anoRestantes + transRestantes;

                // Check if transitado days are past deadline
                var transExpirados = false;
                var transAVencer = false;
                if (dataLimite && diasTransitados > 0) {
                    var today2 = new Date();
                    var limite = new Date(dataLimite);
                    var diffMs = limite - today2;
                    var diffDays = Math.ceil(diffMs / 86400000);
                    if (diffDays < 0) transExpirados = true;
                    else if (diffDays <= 14) transAVencer = true;
                }

                var formatDL = function (str) {
                    if (!str) return '';
                    var p = str.split('-');
                    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : str;
                };

                // Bolsa row builder
                var bolsaRow = function (color, label, used, total, warningHtml) {
                    var restantes = total - used;
                    var pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                    var barColor = restantes <= 0 ? '#e74c3c' : color;
                    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
                        '<span style="display:inline-block;width:8px;height:8px;background:' + color + ';' +
                        'border-radius:50%;flex-shrink:0;"></span>' +
                        '<span style="font-size:11px;color:#555;min-width:90px;">' + label + '</span>' +
                        '<div style="flex:1;height:5px;background:#eee;border-radius:3px;overflow:hidden;">' +
                        '<div style="width:' + pct + '%;height:100%;background:' + barColor + ';border-radius:3px;transition:width .3s;"></div>' +
                        '</div>' +
                        '<span style="font-size:11px;color:' + (restantes < 0 ? '#e74c3c' : '#444') + ';min-width:65px;text-align:right;">' +
                        used + ' / ' + total + ' usados' +
                        '</span>' +
                        (warningHtml || '') +
                        '</div>';
                };

                var transWarning = '';
                if (diasTransitados > 0 && dataLimite) {
                    if (transExpirados) {
                        transWarning = '<span style="font-size:10px;background:#fde8e8;color:#c0392b;' +
                            'padding:1px 6px;border-radius:6px;margin-left:4px;">Prazo expirado ' + formatDL(dataLimite) + '</span>';
                    } else if (transAVencer) {
                        transWarning = '<span style="font-size:10px;background:#fef9e7;color:#d68910;' +
                            'padding:1px 6px;border-radius:6px;margin-left:4px;">Prazo: ' + formatDL(dataLimite) + '</span>';
                    } else {
                        transWarning = '<span style="font-size:10px;color:#aaa;margin-left:4px;">até ' + formatDL(dataLimite) + '</span>';
                    }
                }

                legendHtml = '<div style="margin-top:10px;">' +
                    // Bolsas
                    '<div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;' +
                    'padding:10px 12px;margin-bottom:8px;">' +
                    bolsaRow('#2ecc8f', 'Ano ' + year, diasAnoAtualUsados, diasFeriasAno, '') +
                    (diasTransitados > 0
                        ? bolsaRow('#3498db', 'Transitados', diasTransUsados, diasTransitados, transWarning)
                        : '') +
                    '<div style="border-top:1px solid #e0e0e0;margin:6px 0;"></div>' +
                    '<div style="display:flex;justify-content:space-between;font-size:12px;">' +
                    '<span style="color:#666;">Total disponível</span>' +
                    '<span style="font-weight:700;color:' + (totalDisponiveis < 0 ? '#e74c3c' : '#27ae60') + ';">' +
                    totalDisponiveis + ' dias</span>' +
                    '</div>' +
                    '</div>' +
                    // Color legend + calendar link
                    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">' +
                    '<span style="display:flex;align-items:center;gap:8px;font-size:11px;color:#777;">' +
                    '<span style="display:flex;align-items:center;gap:3px;">' +
                    '<span style="display:inline-block;width:9px;height:9px;background:#2ecc8f;border-radius:2px;"></span>Aprov.' +
                    '</span>' +
                    '<span style="display:flex;align-items:center;gap:3px;">' +
                    '<span style="display:inline-block;width:9px;height:9px;background:#f39c12;border-radius:2px;"></span>Pend.' +
                    '</span>' +
                    '<span style="display:flex;align-items:center;gap:3px;">' +
                    '<span style="display:inline-block;width:9px;height:9px;background:#e74c3c;border-radius:2px;"></span>Recus.' +
                    '</span>' +
                    '<span style="display:flex;align-items:center;gap:3px;">' +
                    '<span style="display:inline-block;width:9px;height:9px;background:#3498db;border-radius:2px;"></span>Transitado' +
                    '</span>' +
                    '<span style="display:flex;align-items:center;gap:3px;">' +
                    '<span style="display:inline-block;width:2px;height:9px;background:#e74c3c;border-radius:1px;"></span>Hoje' +
                    '</span>' +
                    '</span>' +
                    '<span class="ferias-open-cal" style="font-size:12px;color:#4a90d9;cursor:pointer;">' +
                    '<span class="fas fa-calendar-alt" style="margin-right:4px;"></span>Calendário</span>' +
                    '</div>' +
                    '</div>';
            }

            this.$el.find('.ferias-timeline-body').html(labelsHtml + barHtml + legendHtml);

            this.bindTooltip();

            this.$el.find('.ferias-open-cal').on('click', this.openCalendar.bind(this));

            // Whole bar opens the full calendar (works in list mode too)
            this.$el.find('.ferias-tl-wrap')
                .css('cursor', 'pointer')
                .attr('title', 'Abrir calendário')
                .on('click', function (e) {
                    e.stopPropagation();
                    this.openCalendar();
                }.bind(this));
        },

        openCalendar: function () {
            Espo.Ui.notify(' ... ');

            this.createView('calendarModal', 'custom:views/ferias/modals/calendar', {
                year: this.calYear,
                periods: this.periodsList || [],
                feriasId: this.model.id,
                feriasName: this.model.get('nomeCompleto') || this.model.get('name')
            }, function (view) {
                Espo.Ui.notify(false);
                view.render();
                // When a new period is created via calendar, reload the timeline
                this.listenTo(view, 'period:created', function () {
                    this._reloadData();
                });
            }.bind(this));
        },

        bindTooltip: function () {
            this.$el.find('.ferias-tl-seg')
                .on('mouseenter', function (e) {
                    var $seg = $(e.currentTarget);
                    var $wrap = $seg.closest('.ferias-tl-wrap');
                    var $tip = $wrap.find('.ferias-tl-tip');

                    var tipo = $seg.attr('data-tipo') || 'Ano Atual';
                    var tipoLabel = tipo === 'Ano Anterior'
                        ? '<span style="background:#3498db;color:#fff;padding:1px 6px;border-radius:8px;font-size:10px;margin-left:4px;">Transitado</span>'
                        : '';
                    var html = '<div style="font-weight:600;margin-bottom:4px;">&#128197; ' +
                        ($seg.attr('data-range') || '') + tipoLabel + '</div>' +
                        '<div>Chefia: <b>' + ($seg.attr('data-chefia') || '—') + '</b></div>' +
                        '<div>Dire&ccedil;&atilde;o: <b>' + ($seg.attr('data-direcao') || '—') + '</b></div>' +
                        '<div>DAF: ' + ($seg.attr('data-daf') || '—') + '</div>';

                    $tip.find('.ferias-tl-tip-content').html(html);
                    $tip.css('left', ($seg.attr('data-center') || '50') + '%').show();
                    $seg.css('opacity', '0.8');
                })
                .on('mouseleave', function (e) {
                    var $seg = $(e.currentTarget);
                    $seg.closest('.ferias-tl-wrap').find('.ferias-tl-tip').hide();
                    $seg.css('opacity', '1');
                });
        }
    });
});
