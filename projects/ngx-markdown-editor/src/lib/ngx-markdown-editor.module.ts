import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxMarkdownEditorComponent } from './ngx-markdown-editor.component';
import { NgxMarkdownEditorResizeSensorComponent } from './resize-sensor/resize-sensor.component';



@NgModule({
  declarations: [
    NgxMarkdownEditorComponent,
    NgxMarkdownEditorResizeSensorComponent
  ],
  imports: [
    FormsModule
  ],
  exports: [
    FormsModule,
    NgxMarkdownEditorComponent,
    NgxMarkdownEditorResizeSensorComponent
  ]
})
export class NgxMarkdownEditorModule { }
