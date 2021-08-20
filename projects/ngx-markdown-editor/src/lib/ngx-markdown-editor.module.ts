import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMarkdownEditorComponent } from './ngx-markdown-editor.component';
import { NgxMarkdownEditorResizeSensorComponent } from './resize-sensor/resize-sensor.component';



@NgModule({
  declarations: [
    NgxMarkdownEditorComponent,
    NgxMarkdownEditorResizeSensorComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    NgxMarkdownEditorComponent,
    NgxMarkdownEditorResizeSensorComponent
  ]
})
export class NgxMarkdownEditorModule { }
