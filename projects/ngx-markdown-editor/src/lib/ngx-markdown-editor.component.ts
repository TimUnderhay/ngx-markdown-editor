import { Component, ViewChild, forwardRef, Renderer2, Attribute, Input, Output, EventEmitter, ElementRef, NgZone, Inject, PLATFORM_ID, SecurityContext } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor, NG_VALIDATORS, Validator, AbstractControl, ValidationErrors } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { MdEditorOption } from './types/editor';
import * as marked from 'marked';
import hljs from 'highlight.js';

declare let ace: AceAjax.Ace;

const DEFAULT_EDITOR_OPTION: MdEditorOption = {
  showPreviewPanel: true,
  showBorder: true,
  hideIcons: [],
  usingFontAwesome5: false,
  scrollPastEnd: 0,
  enablePreviewContentClick: false,
  resizable: false
}

@Component({
  selector: 'ngx-markdown-editor',
  styleUrls: ['./ngx-markdown-editor.component.scss'],
  templateUrl: './ngx-markdown-editor.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: NgxMarkdownEditorComponent,
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: NgxMarkdownEditorComponent,
      multi: true
    }
  ]
})

export class NgxMarkdownEditorComponent implements Validator, ControlValueAccessor {

  @ViewChild('aceEditor', { static: true }) aceEditorContainer: ElementRef;
  @ViewChild('previewContainer', { static: true }) previewContainer: ElementRef;
  @Input() hideToolbar: boolean = false;
  @Input() height: string = "300px";
  @Input() preRender: Function;
  @Input() postRender: Function;
  @Input() upload: Function;

  @Input()
  get mode(): string {
    return this._mode;
  }
  set mode(value: string) {
    this._mode = (!value || ['editor', 'preview'].indexOf(value.toLowerCase()) === -1)
      ? 'editor'
      : value;
    setTimeout(() => {
      if (this._aceEditorIns && typeof this._aceEditorIns.resize === 'function') {
        this._aceEditorIns.resize();
      }
    }, 100);
  }
  private _mode: string = 'editor';

  @Input()
  get options(): MdEditorOption {
    return this._options || {};
  }
  set options(value: MdEditorOption) {
    let _options = Object.assign(DEFAULT_EDITOR_OPTION, {}, value);
    let _hideIcons: Record<string, boolean> = {};
    if (typeof _options.showPreviewPanel === 'boolean') {
      this.showPreviewPanel = _options.showPreviewPanel;
    }
    if (Array.isArray(_options.hideIcons)) {
      _options.hideIcons.forEach((v: any) => {
        if (v === 'Refrence') v = 'Reference';
        _hideIcons[v] = true
      });
    }
    this._options = _options;
    this.hideIcons = _hideIcons;
  }
  private _options: any = {};

  @Output() public onEditorLoaded: EventEmitter<any> = new EventEmitter<any>();
  @Output() public onPreviewDomChanged: EventEmitter<HTMLElement> = new EventEmitter<HTMLElement>();

  hideIcons: any = {};
  showPreviewPanel: boolean = true;
  isFullScreen: boolean = false;
  dragover: boolean = false;
  isUploading: boolean = false;

  //#region Markdown value and html value define
  get markdownValue(): string {
    return this._markdownValue || '';
  }
  private _markdownValue: string;

  public previewHtml: any;
  //#endregion


  private _aceEditorIns: any;
  private _aceEditorResizeTimer: any;
  private _convertMarkdownToHtmlTimer: any;
  // private _markedJsOpt: MarkedjsOption;
  private _markedJsOpt: marked.MarkedOptions;
  private _isValueSettedByprogrammatically: boolean;
  private get _hasUploadFunction(): boolean {
    return this.upload && this.upload instanceof Function;
  }
  private get _isInBrowser(): boolean {
    return isPlatformBrowser(this.platform);
  }

  private _onChange = (_: any) => { };
  private _onTouched = () => { };

  constructor(
    @Inject(PLATFORM_ID) private platform: Object,
    @Attribute('required') public required: boolean = false,
    @Attribute('maxlength') public maxlength: number = -1,
    private _ngZone: NgZone,
    private _renderer2: Renderer2,
    private _domSanitizer: DomSanitizer) {

  }

  ngOnInit() {
    if (!this._isInBrowser) return;
    const markedRender = new marked.Renderer();
    markedRender.image = this._getRender('image') as any;
    markedRender.code = this._getRender('code') as any;
    markedRender.table = this._getRender('table') as any;
    markedRender.listitem = this._getRender('listitem') as any;
    let markedjsOpt = {
      renderer: markedRender,
      highlight: (code: any) => hljs.highlightAuto(code).value
    };
    this._markedJsOpt = Object.assign({}, markedjsOpt, this.options.markedjsOpt);
    if (this._markedJsOpt.sanitize === true && typeof this._markedJsOpt.sanitizer !== 'function') {
      this._markedJsOpt.sanitizer = (markdownString: string) => {
        return this._domSanitizer.sanitize(SecurityContext.HTML, markdownString) as string;
      }
    }
  }



  ngAfterViewInit() {
    if (!this._isInBrowser) return;
    const editorElement = this.aceEditorContainer.nativeElement;
    const editor = ace.edit(editorElement);
    editor.$blockScrolling = Infinity;
    editor.getSession().setUseWrapMode(true);
    editor.getSession().setMode("ace/mode/markdown");
    editor.setValue(this.markdownValue, 1);
    editor.setOption('scrollPastEnd', this._options.scrollPastEnd || 0);

    editor.on('change', (e: any) => {
      if (this._isValueSettedByprogrammatically) return;
      let val = editor.getValue();
      this._updateMarkdownValue(val, true);
      this._onChange(this.markdownValue);
    });
    editor.on('blur', () => { this._onTouched() });

    this.onEditorLoaded.next(editor);
    this._aceEditorIns = editor;
  }



  ngOnDestroy() {
    this._aceEditorIns && this._aceEditorIns.destroy();
  }



  writeValue(value: string): void {
    this._updateMarkdownValue(value, false);
  }



  registerOnChange(fn: (_: any) => {}): void {
    this._onChange = fn;
  }



  registerOnTouched(fn: () => {}): void {
    this._onTouched = fn;
  }



  validate(c: AbstractControl): ValidationErrors {
    let result: any = null;
    if (this.required && this.markdownValue.length === 0) {
      result = { required: true };
    }
    if (this.maxlength > 0 && this.markdownValue.length > this.maxlength) {
      result = { maxlength: true };
    }
    return result;
  }



  insertContent(type: string, customContent?: string) {
    if (!this._aceEditorIns) return;
    let selectedText = this._aceEditorIns.getSelectedText();
    let isSelected = !!selectedText;
    let startSize = 2;
    let initText: string = '';
    let range = this._aceEditorIns.selection.getRange();
    switch (type) {
      case 'Bold':
        initText = 'Bold Text';
        selectedText = `**${selectedText || initText}**`;
        break;
      case 'Italic':
        initText = 'Italic Text';
        selectedText = `*${selectedText || initText}*`;
        startSize = 1;
        break;
      case 'Heading':
        initText = 'Heading';
        selectedText = `# ${selectedText || initText}`;
        break;
      case 'Reference':
        initText = 'Reference';
        selectedText = `> ${selectedText || initText}`;
        break;
      case 'Link':
        selectedText = `[](http://)`;
        startSize = 1;
        break;
      case 'Image':
        selectedText = `![](http://)`;
        break;
      case 'Ul':
        selectedText = `- ${selectedText || initText}`
        break;
      case 'Ol':
        selectedText = `1. ${selectedText || initText}`
        startSize = 3;
        break;
      case 'Code':
        initText = 'Source Code';
        selectedText = "```language\r\n" + (selectedText || initText) + "\r\n```";
        startSize = 3;
        break;
      case 'Custom':
        selectedText = customContent;
        startSize = 0;
        break;
    }
    this._aceEditorIns.session.replace(range, selectedText);
    if (!isSelected) {
      range.start.column += startSize;
      range.end.column = range.start.column + initText.length;
      this._aceEditorIns.selection.setRange(range);
    }
    this._aceEditorIns.focus();
  }



  togglePreview() {
    this.showPreviewPanel = !this.showPreviewPanel;
    this.editorResize();
  }



  previewPanelClick(event: Event) {
    if (this.options.enablePreviewContentClick !== true) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }



  fullScreen() {
    this.isFullScreen = !this.isFullScreen;
    this._renderer2.setStyle(document.body, 'overflowY', this.isFullScreen ? 'hidden' : 'auto');
    this.editorResize();
  }



  mdEditorResize(size: any) {
    this.editorResize();
  }



  editorResize(timeOut: number = 100) {
    if (!this._aceEditorIns) return
    if (this._aceEditorResizeTimer) clearTimeout(this._aceEditorResizeTimer);
    this._aceEditorResizeTimer = setTimeout(() => {
      this._aceEditorIns.resize();
      this._aceEditorIns.focus();
    }, timeOut);
  }



  onDragover(evt: DragEvent) {
    evt.stopImmediatePropagation();
    evt.preventDefault();
    if (!this._hasUploadFunction) return;
    this.dragover = true;
  }



  onDrop(evt: DragEvent) {
    evt.stopImmediatePropagation();
    evt.preventDefault();

    if (evt.dataTransfer) {
      this._uploadFiles(evt.dataTransfer.files);
    }
  }



  onDragleave(evt: DragEvent) {
    evt.stopImmediatePropagation();
    evt.preventDefault();
    if (!this._hasUploadFunction) return;
    this.dragover = false;
  }



  onAceEditorPaste(event: ClipboardEvent): void {
    if (event instanceof ClipboardEvent && event.clipboardData && event.clipboardData.files.length > 0) {
      this._uploadFiles(event.clipboardData.files);
    }
  }



  private _updateMarkdownValue(value: any, changedByUser: boolean = false) {
    const normalizedValue = typeof value === 'string' ? value : (value || '').toString();
    if (this._markdownValue === normalizedValue) return;
    this._markdownValue = normalizedValue;
    this._updateDom();
    if (this._aceEditorIns && !changedByUser) {
      this._isValueSettedByprogrammatically = true;
      this._aceEditorIns.setValue(normalizedValue, 1);
      this._isValueSettedByprogrammatically = false;
    }
  }


  
  private _updateDom() {
    if (this._convertMarkdownToHtmlTimer) clearTimeout(this._convertMarkdownToHtmlTimer);
    this._convertMarkdownToHtmlTimer = setTimeout(() => {
      Promise.resolve(this.markdownValue)
        .then((mdContent) => {
          return (this.preRender && this.preRender instanceof Function) ? this.preRender(mdContent) : mdContent;
        })
        .then(mdContent => {
          let html = marked(mdContent || '', this._markedJsOpt);
          return (this.postRender && this.postRender instanceof Function) ? this.postRender(html) : html;
        })
        .then(parsedHtml => {
          this.previewHtml = this._domSanitizer.bypassSecurityTrustHtml(parsedHtml);
          if (this.previewContainer && this.previewContainer.nativeElement) {
            this._ngZone.runOutsideAngular(() => {
              this._renderer2.setProperty(this.previewContainer.nativeElement, 'innerHTML', parsedHtml);
              setTimeout(() => { this.onPreviewDomChanged.next(this.previewContainer.nativeElement); }, 100);
            });
          }
        })
        .catch(err => {
          console.error(err);
        })
    }, 100);
  }



  private _getRender(renderType: 'image' | 'table' | 'code' | 'listitem') {
    let customRender = this.options && this.options.customRender && this.options.customRender[renderType];
    if (customRender && typeof customRender === 'function') {
      return customRender;
    }
    else {
      switch (renderType) {
        case 'image':
          return function (this: any, href: string, title: string, text: string) {
            let out = `<img style="max-width: 100%;" src="${href}" alt="${text}"`;
            if (title) {
              out += ` title="${title}"`;
            }
            out += this.options.xhtml ? "/>" : ">";
            return out;
          };
        case 'code':
          return function (code: any, language: any) {
            let validLang = !!(language && hljs.getLanguage(language));
            let highlighted = '';
            if (validLang) {
              highlighted = hljs.highlight(language, code).value;
            } else {
              let pre = document.createElement('pre');
              pre.innerText = code;
              highlighted = pre.innerHTML;
            }
            return `<pre style="padding: 0; border-radius: 0;"><code class="hljs ${language}">${highlighted}</code></pre>`;
          };
        case 'table':
          return function (header: string, body: string) {
            return `<table class="table table-bordered">\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
          };
        case 'listitem':
          return function (text: any, task: boolean, checked: boolean) {
            if (/^\s*\[[x ]\]\s*/.test(text) || text.startsWith('<input')) {
              if (text.startsWith('<input')) {
                text = text
                  .replace('<input disabled="" type="checkbox">', '<i class="fa fa-square-o"></i>')
                  .replace('<input checked="" disabled="" type="checkbox">', '<i class="fa fa-check-square"></i>');
              } else {
                text = text
                  .replace(/^\s*\[ \]\s*/, '<i class="fa fa-square-o"></i> ')
                  .replace(/^\s*\[x\]\s*/, '<i class="fa fa-check-square"></i> ');
              }
              return `<li>${text}</li>`;
            } else {
              return `<li>${text}</li>`;
            }
          };
      }
    }
  }



  private _uploadFiles(files: FileList): void {
    if (!this._hasUploadFunction || this.isUploading) return;

    if (!files || files.length === 0) {
      this.dragover = false;
      return;
    }

    this.isUploading = true;

    // force dragover to be true, as Uploading mask won't work otherwise
    this.dragover = true;

    Promise.resolve()
      .then(() => {
        return this.upload(files);
      })
      .then(data => {
        if (Array.isArray(data)) {
          let msg = [];
          for (let item of data) {
            let tempMsg = `[${item.name}](${item.url})`;
            if (item.isImg) {
              tempMsg = `!${tempMsg}`;
            }
            msg.push(tempMsg);
          }
          this.insertContent('Custom', msg.join('\r\n'));
        } else {
          console.warn('Invalid upload result. Please using follow this type `UploadResult`.')
        }
        this.isUploading = false;
        this.dragover = false;
      })
      .catch(err => {
        console.error(err);
        this.isUploading = false;
        this.dragover = false;
      });
  }
}
