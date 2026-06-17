define('custom:views/fields/qr-expense/edit', ['views/fields/base'], function (Dep) {

    var SCAN_TIMEOUT_SEC = 15;
    var JSQR_URL = (function () {
        var base = window.location.pathname.split('#')[0].replace(/\/+$/, '');
        return window.location.origin + base + '/client/custom/lib/jsqr.min.js';
    }());

    return Dep.extend({

        templateContent: '<div class="qr-expense-root"></div>',

        setup: function () {
            Dep.prototype.setup.call(this);
            this._scanning   = false;
            this._stream     = null;
            this._rafId      = null;
            this._cdnTimer   = null;
            this._countTimer = null;
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            if (this.mode === 'detail' || this.mode === 'list') {
                this._buildDetailUI();
            } else {
                this._buildUI();
            }
        },

        _buildDetailUI: function () {
            var attachId   = this.model.get('documentocontabId')   || '';
            var attachName = this.model.get('documentocontabName') || '';

            var html = attachId
                ? '<span class="fas fa-paperclip" style="color:#4a90d9;margin-right:5px;"></span>' +
                  '<a href="/?entryPoint=download&id=' + attachId + '" target="_blank">' + attachName + '</a>'
                : '<span style="color:#aaa;">Sem documento</span>';

            this.$el.find('.qr-expense-root').html(html);
        },

        _buildUI: function () {
            var attachName = this.model.get('documentocontabName') || '';
            var attachId   = this.model.get('documentocontabId')   || '';

            var attachHtml = attachId
                ? '<div class="qr-attach" style="margin-top:6px;font-size:13px;color:#555;">' +
                  '<span class="fas fa-paperclip" style="color:#4a90d9;margin-right:5px;"></span>' +
                  '<a href="/?entryPoint=download&id=' + attachId + '" target="_blank">' + attachName + '</a></div>'
                : '<div class="qr-attach" style="display:none;margin-top:6px;font-size:13px;color:#555;"></div>';

            var html =
                '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">' +
                    '<button class="btn btn-default qr-btn-scan" type="button" ' +
                    'style="display:flex;align-items:center;gap:6px;padding:7px 14px;">' +
                    '<span class="fas fa-camera" style="font-size:15px;"></span>' +
                    '<span class="qr-btn-label">Scan / Foto</span>' +
                    '</button>' +
                    '<span class="qr-status" style="font-size:13px;color:#888;"></span>' +
                '</div>' +

                '<div class="qr-camera-wrap" style="display:none;position:relative;max-width:420px;' +
                'border-radius:10px;overflow:hidden;background:#000;">' +
                    '<video class="qr-video" autoplay playsinline muted ' +
                    'style="width:100%;display:block;max-height:300px;object-fit:cover;"></video>' +

                    '<canvas class="qr-canvas" style="display:none;"></canvas>' +

                    '<div style="position:absolute;inset:0;display:flex;align-items:center;' +
                    'justify-content:center;pointer-events:none;">' +
                        '<div style="width:55%;aspect-ratio:1;border:3px solid rgba(74,144,217,.9);' +
                        'border-radius:10px;box-shadow:0 0 0 2000px rgba(0,0,0,.4);"></div>' +
                    '</div>' +

                    '<div class="qr-countdown" style="position:absolute;top:10px;right:12px;' +
                    'background:rgba(0,0,0,.6);color:#fff;border-radius:20px;' +
                    'padding:3px 11px;font-size:13px;font-weight:600;">' +
                        '<span class="fas fa-clock" style="margin-right:4px;font-size:11px;"></span>' +
                        '<span class="qr-secs">' + SCAN_TIMEOUT_SEC + '</span>s' +
                    '</div>' +

                    '<div style="position:absolute;bottom:10px;left:0;right:0;' +
                    'display:flex;justify-content:center;gap:10px;">' +
                        '<button class="btn qr-btn-cancel" type="button" ' +
                        'style="background:rgba(0,0,0,.55);color:#fff;border:none;' +
                        'border-radius:20px;padding:5px 18px;font-size:12px;">' +
                        'Cancelar</button>' +
                    '</div>' +
                '</div>' +

                attachHtml +
                '<div class="qr-error" style="display:none;color:#e74c3c;font-size:13px;margin-top:5px;"></div>';

            this.$el.find('.qr-expense-root').html(html);

            this.$el.find('.qr-btn-scan').on('click', function () {
                this._startScan();
            }.bind(this));

            this.$el.find('.qr-btn-cancel').on('click', function () {
                this._stopCamera();
            }.bind(this));
        },

        _startScan: function () {
            this._clearError();

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this._showError('Camera nao suportada. Usa HTTPS e um browser moderno.');
                return;
            }

            this._setStatus('A carregar camera...');
            this._setBtnState('loading');

            this._loadJsQR(function () {
                navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
                }).then(function (stream) {
                    this._stream = stream;
                    this._scanning = true;
                    this._openCameraUI(stream);
                }.bind(this)).catch(function (err) {
                    this._setBtnState('idle');
                    this._showError('Sem acesso a camera: ' + err.message);
                }.bind(this));
            }.bind(this));
        },

        _openCameraUI: function (stream) {
            var $wrap  = this.$el.find('.qr-camera-wrap');
            var video  = this.$el.find('.qr-video')[0];
            var canvas = this.$el.find('.qr-canvas')[0];
            var ctx    = canvas.getContext('2d');

            $wrap.show();
            this._setBtnState('scanning');
            this._setStatus('');

            video.srcObject = stream;
            video.play();

            var remaining = SCAN_TIMEOUT_SEC;
            var $secs = this.$el.find('.qr-secs');

            this._countTimer = setInterval(function () {
                remaining -= 1;
                $secs.text(remaining);

                if (remaining <= 0) {
                    clearInterval(this._countTimer);
                    this._onTimeout(canvas, ctx, video);
                }
            }.bind(this), 1000);

            var self = this;
            var tick = function () {
                if (!self._scanning) { return; }

                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width  = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    var code    = window.jsQR(imgData.data, imgData.width, imgData.height, {
                        inversionAttempts: 'dontInvert'
                    });

                    if (code && code.data) {
                        var parsed = self._parseQrAT(code.data);
                        if (parsed) {
                            clearInterval(self._countTimer);
                            self._applyParsed(parsed);
                            self._captureAndUpload(canvas, true);
                            return;
                        }
                    }
                }

                self._rafId = requestAnimationFrame(tick);
            };

            this._rafId = requestAnimationFrame(tick);
        },

        _onTimeout: function (canvas, ctx, video) {
            if (video.readyState >= video.HAVE_ENOUGH_DATA) {
                canvas.width  = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }

            this._captureAndUpload(canvas, false);
        },

        _parseQrAT: function (raw) {
            if (!raw || raw.indexOf('A:') === -1 || raw.indexOf('O:') === -1) {
                return null;
            }

            var fields = {};
            raw.split('*').forEach(function (pair) {
                var idx = pair.indexOf(':');
                if (idx > -1) {
                    fields[pair.substring(0, idx)] = pair.substring(idx + 1);
                }
            });

            var nif    = fields['A'] || '';
            var total  = parseFloat(fields['O'] || '0') || 0;

            var pairs = [
                { base: parseFloat(fields['I2'] || '0'), iva: parseFloat(fields['I3'] || '0') },
                { base: parseFloat(fields['I4'] || '0'), iva: parseFloat(fields['I5'] || '0') },
                { base: parseFloat(fields['I6'] || '0'), iva: parseFloat(fields['I7'] || '0') }
            ];

            var best = pairs.reduce(function (a, b) { return b.base > a.base ? b : a; }, { base: 0, iva: 0 });

            return {
                nif:     nif,
                subtotal: best.base,
                iva:      best.iva,
                taxaiva:  best.base > 0 ? Math.round((best.iva / best.base) * 100) : 0,
                total:    total
            };
        },

        _applyParsed: function (p) {
            this.model.set('nifdocumento', p.nif);
            this.model.set('subtotal',     p.subtotal);
            this.model.set('iva',          p.iva);
            this.model.set('taxaiva',      p.taxaiva);
            this.model.set('total',        p.total);
        },

        _captureAndUpload: function (canvas, qrSuccess) {
            var self = this;

            canvas.toBlob(function (blob) {
                self._stopCamera();

                if (!blob) {
                    self._setBtnState(qrSuccess ? 'done' : 'idle');
                    return;
                }

                self._setStatus('A enviar imagem...');
                self._uploadBlob(blob, qrSuccess);
            }, 'image/jpeg', 0.88);
        },

        _uploadBlob: function (blob, qrSuccess) {
            var self     = this;
            var fileName = 'fatura-' + Date.now() + '.jpg';
            var reader   = new FileReader();

            reader.onload = function (e) {
                var payload = {
                    name:       fileName,
                    type:       'image/jpeg',
                    parentType: 'Contabdoc',
                    field:      'documentocontab',
                    role:       'Attachment',
                    file:       e.target.result
                };

                Espo.Ajax.postRequest('Attachment', payload)
                    .then(function (resp) {
                        if (resp && resp.id) {
                            self.model.set('documentocontabId',   resp.id);
                            self.model.set('documentocontabName', resp.name || fileName);
                            self._updateAttachLine(resp.id, resp.name || fileName);
                        }

                        self._setBtnState(qrSuccess ? 'done' : 'idle');
                        self._setStatus(qrSuccess ? 'QR lido com sucesso' : 'Foto guardada');
                    })
                    .catch(function () {
                        self._setBtnState(qrSuccess ? 'done' : 'idle');
                        self._setStatus('Imagem nao enviada');
                    });
            };

            reader.readAsDataURL(blob);
        },

        _updateAttachLine: function (id, name) {
            var $a = this.$el.find('.qr-attach');
            $a.html(
                '<span class="fas fa-paperclip" style="color:#4a90d9;margin-right:5px;"></span>' +
                '<a href="/?entryPoint=download&id=' + id + '" target="_blank">' + name + '</a>'
            ).show();
        },

        _setBtnState: function (state) {
            var $btn   = this.$el.find('.qr-btn-scan');
            var $label = this.$el.find('.qr-btn-label');
            var $icon  = $btn.find('.fas');

            $btn.prop('disabled', state === 'loading' || state === 'scanning');

            if (state === 'idle') {
                $icon.attr('class', 'fas fa-camera').css('font-size', '15px');
                $label.text('Scan / Foto');
                $btn.removeClass('btn-success btn-warning').addClass('btn-default');
            } else if (state === 'loading') {
                $icon.attr('class', 'fas fa-spinner fa-spin');
                $label.text('A carregar...');
                $btn.removeClass('btn-success btn-warning').addClass('btn-default');
            } else if (state === 'scanning') {
                $icon.attr('class', 'fas fa-camera').css('font-size', '15px');
                $label.text('A ler...');
            } else if (state === 'done') {
                $icon.attr('class', 'fas fa-check');
                $label.text('QR lido');
                $btn.removeClass('btn-default btn-warning').addClass('btn-success');
            }
        },

        _setStatus: function (msg) {
            this.$el.find('.qr-status').text(msg);
        },

        _showError: function (msg) {
            this.$el.find('.qr-error').text(msg).show();
        },

        _clearError: function () {
            this.$el.find('.qr-error').hide().text('');
        },

        _stopCamera: function () {
            this._scanning = false;

            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }

            if (this._countTimer) {
                clearInterval(this._countTimer);
                this._countTimer = null;
            }

            if (this._stream) {
                this._stream.getTracks().forEach(function (t) { t.stop(); });
                this._stream = null;
            }

            var video = this.$el.find('.qr-video')[0];
            if (video) { video.srcObject = null; }

            this.$el.find('.qr-camera-wrap').hide();
            this._setBtnState(this.model.get('documentocontabId') ? 'done' : 'idle');
        },

        _loadJsQR: function (cb) {
            if (window.jsQR) { cb(); return; }

            var script  = document.createElement('script');
            script.src  = JSQR_URL;
            script.onload  = cb;
            script.onerror = function () {
                this._showError('Erro ao carregar jsQR.');
                this._setBtnState('idle');
            }.bind(this);

            document.head.appendChild(script);
        },

        onRemove: function () {
            this._stopCamera();
            Dep.prototype.onRemove.call(this);
        }
    });
});
