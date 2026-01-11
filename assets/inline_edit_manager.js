/**
 * Inline Edit Manager - Vanilla JS Event Delegation Version
 * 
 * Event delegation ile tek bir listener ile tüm inline-edit field'larını yönetir.
 * SDK gibi çalışır - dış plugin'lere bağımlı değildir. Event-based sistem kullanır.
 * 
 * Event Sistemi:
 * - 'opened': Edit mode açıldığında emit edilir
 * - 'clicked': Edit butonuna tıklandığında emit edilir
 * - 'save': Save işlemi başlamadan önce emit edilir
 * - 'saved': Save işlemi başarıyla tamamlandığında emit edilir
 * - 'cancel': Cancel işlemi yapıldığında emit edilir
 * - 'rejected': Cancel işlemi yapıldığında emit edilir (alias)
 * - 'error': Hata oluştuğunda emit edilir
 * - 'closed': Edit mode kapandığında emit edilir (save veya cancel sonrası)
 * 
 * Kullanım:
 * ```javascript
 * // Global instance
 * const inlineEditManager = new InlineEditManager()
 * 
 * // Event dinleme
 * inlineEditManager.on('opened', (data) => {
 *   // Edit mode açıldı
 *   const { field, fieldData, input } = data
 *   // Choices.js gibi plugin'leri burada yönetebilirsiniz
 *   if (input && input.hasAttribute('data-choices')) {
 *     // Choices.js instance'ını bul ve yönet
 *   }
 * })
 * 
 * inlineEditManager.on('save', (data) => {
 *   // Save başlamadan önce
 *   const { field, value, input } = data
 *   // Plugin'leri burada kontrol edebilirsiniz
 * })
 * 
 * inlineEditManager.on('cancel', (data) => {
 *   // Cancel edildiğinde
 *   const { field, input, originalValue } = data
 *   // Plugin'leri burada reset edebilirsiniz
 * })
 * ```
 * 
 * HTML Yapısı:
 * <div class="inline-edit-field" 
 *      data-inline-edit-manager="true"
 *      data-inline-edit-url="/personel/1/field/name"
 *      data-inline-edit-field-path="personel.name"
 *      data-inline-edit-value="Mehmet"
 *      data-inline-edit-input-type="input"
 *      data-inline-edit-html-type="text"
 *      data-inline-edit-placeholder="Ad giriniz">
 *   <div class="inline-edit-read" data-inline-edit-read-mode>
 *     <span data-inline-edit-editable>Mehmet</span>
 *     <button type="button" data-inline-edit-enable>Edit</button>
 *   </div>
 *   <div class="inline-edit-edit d-none" data-inline-edit-edit-mode>
 *     <input type="text" data-inline-edit-input value="Mehmet">
 *     <button type="button" data-inline-edit-save>Save</button>
 *     <button type="button" data-inline-edit-cancel>Cancel</button>
 *     <div class="invalid-feedback d-block" data-inline-edit-error></div>
 *   </div>
 * </div>
 */
class InlineEditManager {
    constructor() {
        this.activeField = null // Aktif edit mode olan field container
        this.activeFieldData = null // Aktif field'ın data'sı
        this.boundHandleClickOutside = null
        this.isInitialized = false // Initialization flag
        this.boundHandleClick = null // Click handler reference
        this.boundHandleKeydown = null // Keydown handler reference
        this.eventListeners = {
            opened: [],
            save: [],
            saved: [],
            cancel: [],
            rejected: [],
            clicked: [],
            error: [],
            closed: []
        }
        this.init()
    }

    /**
     * Event listener ekle
     * @param {string} eventName - Event adı: 'opened', 'save', 'saved', 'cancel', 'rejected', 'clicked', 'error', 'closed'
     * @param {Function} callback - Callback fonksiyonu
     */
    on(eventName, callback) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].push(callback)
        } else {
            console.warn(`Unknown event: ${eventName}`)
        }
    }

    /**
     * Event listener kaldır
     * @param {string} eventName - Event adı
     * @param {Function} callback - Kaldırılacak callback fonksiyonu
     */
    off(eventName, callback) {
        if (this.eventListeners[eventName]) {
            const index = this.eventListeners[eventName].indexOf(callback)
            if (index > -1) {
                this.eventListeners[eventName].splice(index, 1)
            }
        }
    }

    /**
     * Event emit et
     * @param {string} eventName - Event adı
     * @param {Object} data - Event data'sı
     */
    emit(eventName, data = {}) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(callback => {
                try {
                    callback({
                        ...data,
                        field: data.field || this.activeField,
                        fieldData: data.fieldData || this.activeFieldData
                    })
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error)
                }
            })
        }
    }

    init() {
        // Eğer zaten init edildiyse tekrar init etme
        if (this.isInitialized) {
            return
        }

        this.isInitialized = true

        // Event delegation - tek listener tüm click'leri yakalar
        this.boundHandleClick = (e) => {
            // Sadece data-inline-edit-manager="true" olan field'ları işle
            const field = e.target.closest('[data-inline-edit-manager="true"]')
            
            // Enable edit butonuna tıklama (öncelikli kontrol)
            if (e.target.matches('[data-inline-edit-enable]') || e.target.closest('[data-inline-edit-enable]')) {
                if (field) {
                    this.enableEdit(field, e)
                }
                return
            }

            // Read mode içine tıklama (editable area veya read mode container)
            if (field) {
                const readMode = field.querySelector('[data-inline-edit-read-mode]')
                if (readMode && readMode.contains(e.target)) {
                    // Edit mode açık değilse enable edit yap
                    const editMode = field.querySelector('[data-inline-edit-edit-mode]')
                    if (editMode && editMode.classList.contains('d-none')) {
                        this.enableEdit(field, e)
                    }
                    return
                }
            }

            // Save butonuna tıklama
            if (e.target.matches('[data-inline-edit-save]') || e.target.closest('[data-inline-edit-save]')) {
                if (field) {
                    this.save(field, e)
                }
                return
            }

            // Cancel butonuna tıklama
            if (e.target.matches('[data-inline-edit-cancel]') || e.target.closest('[data-inline-edit-cancel]')) {
                if (field) {
                    this.cancel(field, e)
                }
                return
            }

            // Click outside - aktif field varsa ve dışına tıklandıysa cancel yap
            if (this.activeField && !this.activeField.contains(e.target)) {
                const editMode = this.activeField.querySelector('[data-inline-edit-edit-mode]')
                if (editMode && !editMode.contains(e.target)) {
                    this.cancel(this.activeField)
                }
            }
        }

        // Click event listener'ı ekle
        document.addEventListener('click', this.boundHandleClick)

        // Keyboard shortcuts - tek listener
        this.boundHandleKeydown = (e) => {
            if (!this.activeField) return

            const input = this.activeField.querySelector('[data-inline-edit-input]')
            if (!input || document.activeElement !== input) {
                return
            }

            // Enter = Save
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                this.save(this.activeField)
                return
            }

            // Escape = Cancel
            if (e.key === 'Escape') {
                e.preventDefault()
                this.cancel(this.activeField)
                return
            }
        }

        // Keydown event listener'ı ekle
        document.addEventListener('keydown', this.boundHandleKeydown)
    }

    /**
     * Cleanup - event listener'ları kaldır
     */
    destroy() {
        if (this.boundHandleClick) {
            document.removeEventListener('click', this.boundHandleClick)
            this.boundHandleClick = null
        }
        
        if (this.boundHandleKeydown) {
            document.removeEventListener('keydown', this.boundHandleKeydown)
            this.boundHandleKeydown = null
        }

        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
            this.boundHandleClickOutside = null
        }

        this.isInitialized = false
    }

    /**
     * Edit mode'u aktif eder
     */
    enableEdit(fieldElement, event) {
        if (event) {
            event.preventDefault()
            event.stopPropagation()
        }

        // Eğer başka bir field edit mode'daysa önce onu kapat
        if (this.activeField && this.activeField !== fieldElement) {
            this.cancel(this.activeField)
        }

        // Edit mode zaten açıksa
        const editMode = fieldElement.querySelector('[data-inline-edit-edit-mode]')
        if (editMode && !editMode.classList.contains('d-none')) {
            return
        }

        // Data attribute'lardan bilgileri oku
        const url = fieldElement.dataset.inlineEditUrl
        const fieldPath = fieldElement.dataset.inlineEditFieldPath || ''
        const originalValue = fieldElement.dataset.inlineEditValue || ''
        const inputType = fieldElement.dataset.inlineEditInputType || 'input'
        const htmlType = fieldElement.dataset.inlineEditHtmlType || 'text'
        const placeholder = fieldElement.dataset.inlineEditPlaceholder || ''

        // Read mode ve edit mode'u bul
        const readMode = fieldElement.querySelector('[data-inline-edit-read-mode]')
        
        if (!readMode || !editMode) {
            console.warn('Inline edit field structure invalid:', fieldElement)
            return
        }

        // Edit mode'u aç
        readMode.classList.add('d-none')
        editMode.classList.remove('d-none')

        // Input'u bul ve ayarla
        const input = editMode.querySelector('[data-inline-edit-input]')
        if (input) {
            if (inputType === 'input' && input.tagName === 'INPUT') {
                input.type = htmlType
            }
            if (placeholder) {
                input.placeholder = placeholder
            }
            
            // Input değerini set et
            this.setInputValue(input, originalValue)

            setTimeout(() => {
                input.focus()
                if (inputType === 'input' && input.tagName === 'INPUT') {
                    input.select()
                }
            }, 50)
        }

        // Aktif field'ı kaydet
        this.activeField = fieldElement
        this.activeFieldData = {
            url,
            fieldPath,
            originalValue,
            inputType,
            htmlType,
            placeholder
        }

        // Eski click outside listener'ı kaldır (eğer varsa)
        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
        }

        // Click outside listener ekle
        this.boundHandleClickOutside = (e) => {
            if (!this.activeField || this.activeField !== fieldElement) return
            
            const activeEditMode = this.activeField.querySelector('[data-inline-edit-edit-mode]')
            if (!activeEditMode) return
            
            // Edit mode içindeki elementlere tıklanmadıysa cancel yap
            if (!activeEditMode.contains(e.target)) {
                this.cancel(this.activeField)
            }
        }

        // Capture phase'de dinle (biraz gecikmeyle ki enable edit event'i tamamlansın)
        setTimeout(() => {
            document.addEventListener('click', this.boundHandleClickOutside, true)
        }, 0)

        // Error mesajını temizle
        this.clearError(fieldElement)

        // Event emit: opened (edit mode açıldı)
        this.emit('opened', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            input: input
        })

        // Event emit: clicked (edit butonuna tıklandı)
        this.emit('clicked', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            input: input
        })
    }

    /**
     * Edit mode'u kapatır ve değişiklikleri kaydeder
     */
    async save(fieldElement, event) {
        if (event) {
            event.preventDefault()
            event.stopPropagation()
        }

        if (!fieldElement || fieldElement !== this.activeField) {
            return
        }

        const editMode = fieldElement.querySelector('[data-inline-edit-edit-mode]')
        if (!editMode || editMode.classList.contains('d-none')) {
            return
        }

        const input = editMode.querySelector('[data-inline-edit-input]')
        if (!input) {
            return
        }

        // Input değerini al
        const { value: newValue, isMultiple, selectedTexts } = this.getInputValue(input)
        
        // Değerleri normalize et ve karşılaştır
        const newValueStr = this.normalizeValueForComparison(newValue)
        const oldValueStr = this.normalizeValueForComparison(this.activeFieldData?.originalValue || '')
        
        // Değer değişmediyse sadece edit mode'u kapat
        if (newValueStr === oldValueStr) {
            this.closeEditMode(fieldElement, 'no_change')
            return
        }

        // Event emit: save (save başlamadan önce)
        this.emit('save', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            value: newValue,
            isMultiple: isMultiple,
            input: input,
            preventDefault: false
        })

        // Loading state
        this.setLoadingState(fieldElement, true)

        try {
            // PATCH request gönder
            const response = await this.submitPatch(newValue, isMultiple)

            // Response'u handle et (selectedTexts'i de gönder)
            await this.handleResponse(response, newValue, fieldElement, selectedTexts)
        } catch (error) {
            console.error('Save error:', error)
            this.showError(fieldElement, 'Kaydetme sırasında bir hata oluştu. Lütfen tekrar deneyin.')
            this.setLoadingState(fieldElement, false)

            // Event emit: error
            this.emit('error', {
                field: fieldElement,
                fieldData: this.activeFieldData,
                error: error,
                action: 'save'
            })
        }
    }

    /**
     * Edit mode'u kapatır ve değişiklikleri iptal eder
     */
    cancel(fieldElement, event) {
        if (event) {
            event.preventDefault()
            event.stopPropagation()
        }

        if (!fieldElement) {
            return
        }

        const editMode = fieldElement.querySelector('[data-inline-edit-edit-mode]')
        if (!editMode || editMode.classList.contains('d-none')) {
            return
        }

        // Click outside listener'ı kaldır
        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
            this.boundHandleClickOutside = null
        }

        // Original değere geri dön
        const input = editMode.querySelector('[data-inline-edit-input]')
        if (input && this.activeFieldData) {
            input.value = this.activeFieldData.originalValue
        }

        // Event emit: cancel (iptal edildi)
        this.emit('cancel', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            input: input,
            originalValue: this.activeFieldData?.originalValue
        })

        // Event emit: rejected (iptal edildi - alias)
        this.emit('rejected', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            input: input,
            originalValue: this.activeFieldData?.originalValue
        })

        // Edit mode'u kapat
        this.closeEditMode(fieldElement, 'cancelled')
    }

    /**
     * PATCH request gönderir
     */
    async submitPatch(value, isMultiple = false) {
        if (!this.activeFieldData) {
            throw new Error('Active field data not found')
        }

        const url = this.activeFieldData.url
        const fieldPath = this.activeFieldData.fieldPath

        // Field path'i URL-encoded formatına çevir
        const body = this.buildUrlEncodedBody(fieldPath, value, isMultiple)

        // Headers
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }

        // CSRF token ekle (eğer varsa)
        const csrfToken = this.getCsrfToken()
        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken
        }

        // Fetch request (PATCH metodu)
        const response = await fetch(url, {
            method: 'PATCH',
            headers: headers,
            body: body,
            credentials: 'same-origin'
        })

        return response
    }

    /**
     * Field path'i URL-encoded formatına çevirir
     * Örnek: "personel.name" -> "personel[name]=value"
     * Örnek (multiple): "personel.departmanlar" -> "personel[departmanlar][]=value1&personel[departmanlar][]=value2"
     */
    buildUrlEncodedBody(path, value, isMultiple = false) {
        if (!path) {
            if (Array.isArray(value)) {
                return this.buildArrayQueryString('value', value)
            }
            return `value=${encodeURIComponent(value)}`
        }

        const keys = path.split('.') // ["personel", "departmanlar"]

        // Symfony nested form formatı: personel[departmanlar]
        let fieldName = keys[0] // "personel"
        for (let i = 1; i < keys.length; i++) {
            fieldName += `[${keys[i]}]` // "personel" + "[departmanlar]" = "personel[departmanlar]"
        }

        // Multiple select için array formatı
        if (isMultiple && Array.isArray(value)) {
            return this.buildArrayQueryString(fieldName, value)
        }

        // Single value için normal format
        const params = new URLSearchParams()
        params.append(fieldName, value)

        return params.toString()
    }

    /**
     * Response'u handle eder
     */
    async handleResponse(response, newValue, fieldElement, displayValue = null) {
        const contentType = response.headers.get('Content-Type')
        const isJson = contentType && contentType.includes('application/json')

        if (!isJson) {
            throw new Error('Response JSON değil')
        }

        const data = await response.json()

        if (response.ok && response.status === 200) {
            // Başarılı - gönderilen veriyi ekrana bas
            this.updateDOM(newValue, fieldElement, displayValue)
            this.closeEditMode(fieldElement, 'saved')

            // Success notification
            const message = data.message || 'Field başarıyla güncellendi.'
            if (window.flashNotification) {
                window.flashNotification.success(message)
            }

            // Event emit: saved (save başarılı)
            this.emit('saved', {
                field: fieldElement,
                fieldData: this.activeFieldData,
                value: newValue,
                displayValue: displayValue,
                response: data
            })
        } else {
            // Hata durumu
            const errorMessage = this.extractErrorMessage(data, fieldElement)
            this.showError(fieldElement, errorMessage)
            this.setLoadingState(fieldElement, false)

            // Edit mode'u AÇIK TUT (kapatma, kullanıcı hatayı görebilsin ve düzeltebilsin)
            // readMode ve editMode değişikliği yapmıyoruz, edit mode açık kalacak
            
            // Aktif field'ı tutmaya devam et (cancel edilmediği sürece)
            // Kullanıcı hatayı düzeltebilsin

            // Error notification
            if (window.flashNotification) {
                window.flashNotification.error(errorMessage)
            }

            // Event emit: error (save hatası)
            this.emit('error', {
                field: fieldElement,
                fieldData: this.activeFieldData,
                error: errorMessage,
                action: 'save',
                response: data
            })
        }
    }

    /**
     * Edit mode'u kapatır ve temizlik yapar
     */
    closeEditMode(fieldElement, reason = 'closed') {
        // Click outside listener'ı kaldır
        if (this.boundHandleClickOutside) {
            document.removeEventListener('click', this.boundHandleClickOutside, true)
            this.boundHandleClickOutside = null
        }

        // Read mode ve edit mode geçişi
        const readMode = fieldElement.querySelector('[data-inline-edit-read-mode]')
        const editMode = fieldElement.querySelector('[data-inline-edit-edit-mode]')

        if (readMode) {
            readMode.classList.remove('d-none')
        }
        if (editMode) {
            editMode.classList.add('d-none')
        }

        // Error mesajını temizle
        this.clearError(fieldElement)

        // Loading state'i temizle
        this.setLoadingState(fieldElement, false)

        // Aktif field'ı temizle
        if (this.activeField === fieldElement) {
            this.activeField = null
            this.activeFieldData = null
        }

        // Event emit: closed
        this.emit('closed', {
            field: fieldElement,
            fieldData: this.activeFieldData,
            reason: reason
        })
    }

    /**
     * DOM'u günceller (başarılı response sonrası)
     */
    updateDOM(value, fieldElement, providedDisplayValue = null) {
        // HTML type'ı kontrol et (date için format değiştir)
        const htmlType = fieldElement.dataset.inlineEditHtmlType || 'text'
        let displayValue = providedDisplayValue !== null ? providedDisplayValue : value

        // Display value'yu formatla
        if (providedDisplayValue === null) {
            displayValue = this.formatDisplayValue(value, htmlType)
        }

        // Editable target'ı güncelle
        this.updateEditableElement(fieldElement, displayValue)

        // Original value'yu güncelle
        this.updateFieldValue(fieldElement, value)

        // Input value'yu güncelle (bir sonraki edit için - raw value)
        // Select için array değerler doğrudan set edilemez, bu yüzden skip ediyoruz
        const input = fieldElement.querySelector('[data-inline-edit-input]')
        if (input && input.tagName !== 'SELECT') {
            input.value = value
        }
    }

    /**
     * Error mesajını gösterir
     */
    showError(fieldElement, message) {
        const errorMessage = fieldElement.querySelector('[data-inline-edit-error]')
        if (errorMessage) {
            errorMessage.textContent = message
            errorMessage.classList.add('d-block')
        }

        const input = fieldElement.querySelector('[data-inline-edit-input]')
        if (input) {
            input.classList.add('is-invalid')
        }
    }

    /**
     * Error mesajını temizler
     */
    clearError(fieldElement) {
        const errorMessage = fieldElement.querySelector('[data-inline-edit-error]')
        if (errorMessage) {
            errorMessage.textContent = ''
            errorMessage.classList.remove('d-block')
        }

        const input = fieldElement.querySelector('[data-inline-edit-input]')
        if (input) {
            input.classList.remove('is-invalid')
        }
    }

    /**
     * Loading state'i ayarlar
     */
    setLoadingState(fieldElement, isLoading) {
        const input = fieldElement.querySelector('[data-inline-edit-input]')
        if (input) {
            input.disabled = isLoading
        }

        const saveButton = fieldElement.querySelector('[data-inline-edit-save]')
        if (saveButton) {
            saveButton.disabled = isLoading
            if (isLoading) {
                saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'
            } else {
                saveButton.innerHTML = '<i class="ri-check-line"></i>'
            }
        }

        const cancelButton = fieldElement.querySelector('[data-inline-edit-cancel]')
        if (cancelButton) {
            cancelButton.disabled = isLoading
        }
    }

    /**
     * Response'dan error mesajını çıkarır ve field-specific hataları bulur
     */
    extractErrorMessage(data, fieldElement) {
        const fieldPath = fieldElement?.dataset?.inlineEditFieldPath || ''
        
        // 1. Field-specific hatayı ara
        if (fieldPath && data.errors && typeof data.errors === 'object') {
            const fieldError = this.getNestedError(data.errors, fieldPath.split('.'))
            if (fieldError) {
                return fieldError
            }
        }
        
        // 2. İlk genel hata mesajını al
        if (data.errors && typeof data.errors === 'object') {
            const firstError = this.extractFirstError(data.errors)
            if (firstError) {
                return firstError
            }
        }
        
        // 3. Ana mesajı kullan
        if (data.message) {
            return data.message
        }
        
        // 4. Fallback
        return 'Bir hata oluştu. Lütfen tekrar deneyin.'
    }

    /**
     * Nested error object'inden belirli path'e göre hatayı bulur
     */
    getNestedError(errors, pathParts) {
        let current = errors
        
        for (const part of pathParts) {
            if (current && typeof current === 'object' && current[part]) {
                current = current[part]
            } else {
                return null
            }
        }
        
        return this.extractFirstError(current)
    }

    /**
     * Error object'inden ilk hatayı çıkarır (array, string veya nested object)
     */
    extractFirstError(error) {
        if (Array.isArray(error) && error.length > 0) {
            return error[0]
        }
        
        if (typeof error === 'string') {
            return error
        }
        
        if (typeof error === 'object') {
            const firstNestedError = Object.values(error)[0]
            return this.extractFirstError(firstNestedError)
        }
        
        return null
    }

    /**
     * Değeri karşılaştırma için normalize eder
     */
    normalizeValueForComparison(value) {
        if (Array.isArray(value)) {
            return value.join(',')
        }
        if (typeof value === 'string') {
            return value.trim()
        }
        return String(value)
    }

    /**
     * Display value'yu formatlar
     */
    formatDisplayValue(value, htmlType) {
        let displayValue = value

        // Array değerler için string'e çevir
        if (Array.isArray(value)) {
            displayValue = value.join(',')
        }

        // Date formatı: YYYY-MM-DD -> DD.MM.YYYY
        if (htmlType === 'date' && displayValue && !Array.isArray(displayValue)) {
            try {
                const dateMatch = String(displayValue).match(/^(\d{4})-(\d{2})-(\d{2})$/)
                if (dateMatch) {
                    const [, year, month, day] = dateMatch
                    displayValue = `${day}.${month}.${year}`
                }
            } catch (e) {
                // Date parse hatası, original value'yu kullan
            }
        }

        return displayValue
    }

    /**
     * Editable element'i günceller
     */
    updateEditableElement(fieldElement, displayValue) {
        const editable = fieldElement.querySelector('[data-inline-edit-editable]')
        if (!editable) {
            return
        }

        let textValue
        if (Array.isArray(displayValue)) {
            textValue = displayValue.join(', ')
        } else if (displayValue !== null && displayValue !== undefined) {
            textValue = String(displayValue)
        } else {
            textValue = '-'
        }
        editable.textContent = textValue
    }

    /**
     * Field value'yu günceller (data attribute ve activeFieldData)
     */
    updateFieldValue(fieldElement, value) {
        if (!this.activeFieldData) {
            return
        }

        this.activeFieldData.originalValue = value
        const valueForAttribute = Array.isArray(value) ? value.join(',') : value
        fieldElement.dataset.inlineEditValue = valueForAttribute
    }

    /**
     * Input element'ine değeri set eder (select, input, textarea desteği)
     */
    setInputValue(input, value) {
        if (input.tagName === 'SELECT') {
            const isMultiple = input.hasAttribute('multiple')
            
            // Önce tüm option'ları seçili olmaktan çıkar
            Array.from(input.options).forEach(option => {
                option.selected = false
            })
            
            if (value) {
                // Value virgülle ayrılmış string olabilir (multiple için) veya tek değer
                const values = isMultiple && String(value).includes(',') 
                    ? String(value).split(',').map(v => v.trim()).filter(v => v)
                    : [String(value).trim()].filter(v => v)
                
                // Her bir değer için ilgili option'ı seçili yap
                values.forEach(val => {
                    const option = Array.from(input.options).find(opt => opt.value === val)
                    if (option) {
                        option.selected = true
                    }
                })
            }
        } else {
            // Input veya textarea için normal value set
            input.value = value
        }
    }

    /**
     * Input element'inden değeri alır (select, input, textarea desteği)
     */
    getInputValue(input) {
        if (input.tagName === 'SELECT') {
            const isMultiple = input.hasAttribute('multiple')
            
            if (isMultiple) {
                const selectedOptions = Array.from(input.selectedOptions || input.options).filter(opt => opt.selected)
                return {
                    value: selectedOptions.map(opt => opt.value),
                    isMultiple: true,
                    selectedTexts: selectedOptions.map(opt => opt.textContent.trim())
                }
            } else {
                const selectedOption = input.options[input.selectedIndex]
                return {
                    value: input.value || '',
                    isMultiple: false,
                    selectedTexts: selectedOption ? selectedOption.textContent.trim() : null
                }
            }
        }
        
        return {
            value: input.value.trim(),
            isMultiple: false,
            selectedTexts: null
        }
    }

    /**
     * Array değerler için query string oluşturur
     */
    buildArrayQueryString(fieldName, values) {
        const encodedFieldName = encodeURIComponent(fieldName + '[]')
        return values.map(v => `${encodedFieldName}=${encodeURIComponent(v)}`).join('&')
    }

    /**
     * CSRF token'ı alır (meta tag'den veya cookie'den)
     */
    getCsrfToken() {
        // Meta tag'den dene
        const metaTag = document.querySelector('meta[name="csrf-token"]')
        if (metaTag) {
            return metaTag.getAttribute('content')
        }

        // Cookie'den dene
        const cookies = document.cookie.split(';')
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=')
            if (name === 'csrf_token' || name === '_token') {
                return decodeURIComponent(value)
            }
        }

        return null
    }
}

// Export for testing and manual initialization
export default InlineEditManager

