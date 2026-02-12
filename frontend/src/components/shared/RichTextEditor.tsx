import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
}

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const formats = [
  'header',
  'bold',
  'italic',
  'underline',
  'list',
  'bullet',
  'link',
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  disabled = false,
  minHeight = '200px',
}) => {
  return (
    <div style={{ paddingBottom: '2.5rem' }}>
      <ReactQuill
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        theme="snow"
        placeholder={placeholder}
        readOnly={disabled}
        style={{ height: minHeight }}
      />
    </div>
  );
};
