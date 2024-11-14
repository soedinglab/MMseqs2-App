<template>
    <div class="upload-container w-44 gr-2 mb-2">
        <div
            class="upload-drag-area dotted-border gr-4"
            :class="{ 'dotted-border-hover': inFileDrag }"
            @click="triggerFilePicker"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
        >
            <v-btn outlined large style="margin-bottom: 10px">
                <v-icon size="30" color="blue-accent-4">{{ $MDI.FileUpload }}</v-icon>
                Click to select files
            </v-btn>
            <p class="text-body-2">{{ bodyText }}</p>
        </div>
        <input
            class="hidden-button"
            type="file"
            ref="fileInput"
            :multiple="multiple"
            :accept="accept"
            v-on:change="handleUpload"
        />
    </div>
</template>

<script>
    
/**
 * Drag and drop upload box, click triggers the file picker.
 * Selected files are emitted to 'uploadedFiles'.
 */
export default {
    name: "draguploadbox",
    props: {
        multiple: { type: Boolean, default: false },
        accept: { type: String, default: "*" }
    },
    data() {
        return {
            inFileDrag: false,
            bodyText: "Drag & drop at least two PDB/CIF files here."
        };
    },
    methods: {
        triggerFilePicker() {
            this.$refs.fileInput.click();
        },
        handleDrop(event) {
            event.preventDefault();
            this.inFileDrag = false;
            this.$emit("uploadedFiles", event.dataTransfer.files);
        },
        handleDragOver(event) {
            event.preventDefault();
            this.inFileDrag = true;
        },
        handleDragLeave() {
            this.inFileDrag = false;     
        },
        handleUpload(event) {
            this.$emit("uploadedFiles", event.target.files);
        },
    },
}
</script>

<style scoped>
.dotted-border {
    border: 2px dashed #ccc;
    border-width: 2px;
    border-radius: 5px;
    padding: 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
}
.dotted-border:hover {
    border: 2px dashed #1976d2;
    background-color: rgba(21, 101, 192, 0.04);
}
.dotted-border-hover {
    border: 2px dashed #1976d2;
    background-color: rgba(21, 101, 192, 0.04);
}
.upload-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
.upload-drag-area {
    min-height: 250px;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
.hidden-button {
    display: none;
}
</style>