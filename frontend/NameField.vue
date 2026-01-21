<template>
    <div style="display: inline-flex; flex-direction: row; will-change: transform, opacity, background-color, color;"  grow class="text-h6">
        <span  class="hidden-sm-and-down">Results for job:&nbsp;</span>
        <template v-if="inEdit">
            <div class="custom-field-container">
                <v-tooltip bottom color="error" :value="errorState">
                    <template v-slot:activator="{on, attrs}">
                        <div class="input-wrapper"
                            :class="{ 'overflow': errorState,
                                'exists': inputValue.length > 0,
                            }"
                        >
                            
                            <input 
                                type="text" 
                                v-model="inputValue"
                                :placeholder="ticket" 
                                autocomplete="off"
                                class="field-input mono"
                                @keydown.enter="!errorState ? saveName() : () => {}"
                                ref="inputField"
                            />
                            
                            <div class="active-line"></div>

                            <transition name="fade">
                                <button
                                    v-show="inputValue.length > 0"
                                    @click="clearInput"
                                    class="clear-btn" 
                                    type="button"
                                >
                                    <v-icon :color="errorState ? 'error' : 'inherit'">
                                        {{"M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"}}
                                    </v-icon>
                                </button>
                            </transition>
                        </div>
                    </template>
                    <span>Max 40 characters</span>
                </v-tooltip>
            </div>
            <v-btn icon small @click="saveName" title="Save job name" :ripple="false" :disabled="errorState"><v-icon>{{ $MDI.Check }}</v-icon></v-btn>
        </template>
        <template v-else>
            <small class="ticket mono">
                {{ toDisplay }}
            </small>
            <v-btn icon small @click="enableEdit" :ripple="false" title="Edit job name" class="edit-btn"><v-icon dense>{{ $MDI.Pencil }}</v-icon></v-btn>
        </template>
    </div>
</template>

<script>
import { storage, HistoryMixin } from './lib/HistoryMixin'
import emitter from './lib/emitter';

export default {
    name: 'NameField',
    data() {
        return {
        name: "",
        inEdit: false,
        inputValue: "",
    }},
    mixins: [HistoryMixin],
    props: {
        ticket: {
            type: String,
            default: "",
        }
    },
    computed: {
        toDisplay() {
            return this.name != "" ? this.name : this.ticket
        },
        errorState() {
            return this.inputValue?.length > 40
        }
    },
    created() {
        let name = JSON.parse(storage.name_map || "[]").find(e => e.id == this.ticket)?.name
        if (name) {
            this.name = name
        }
    },
    methods: {
        saveName() {
            const name_map = JSON.parse(storage.name_map || "[]")
            if (this.inputValue && this.inputValue != this.ticket) {
                this.name = this.inputValue
                const index = name_map.findIndex(e => e.id == this.ticket)

                if (index < 0) {
                    const obj = {id: this.ticket, name: this.inputValue}
                    name_map.push(obj)
                } else {
                    name_map[index].name = this.inputValue
                }
            } else {
                this.name = ""
                const index = name_map.findIndex(e => e.id == this.ticket)

                if (index != -1) {
                    name_map.splice(index, 1)
                }
            }
            storage.name_map = JSON.stringify(name_map)
            emitter.emit('refresh-job-name', {id: this.ticket, name: this.name})
            this.inEdit = false
        },
        enableEdit() {
            let name = JSON.parse(storage.name_map || "[]").find(e => e.id == this.ticket)?.name
            if (name && name != this.name) {
                this.name = name
            }
            this.inputValue = this.name
            this.inEdit = true
            this.$nextTick(() => 
                setTimeout(() => 
                this.$refs.inputField.focus()
                , 0))
        },
        clearInput() {
            this.inputValue = ""
        },
    },
    watch: {
    }
}
</script>

<style scoped>
small.ticket {
    margin-right: 4px;
}

/* @media print, screen and (max-width: 599px) {
    small.ticket {
        display: inline-block;
        line-height: 0.9;
    }
} */

/* --- 설정 변수 --- */
.custom-field-container {
    --primary-color: #fff;
    --error-color: #ff5252;
    
    max-width: 440px;
    margin-right: 4px;
}

/* --- Wrapper --- */
.input-wrapper {
    position: relative; 
    display: flex;
    align-items: center;
    box-sizing: content-box;
    z-index: 1;
    width: 440px;
}

.input-wrapper::after {
    content: "";
    position: absolute;
    left: 0;
    top: 100%;
    height: 1px;
    width: 100%;
    background-color: #999;
    transition: background-color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1)
}

/* --- Input Styling --- */
.field-input {
    width: 100%;
    border: none;
    outline: none;
    font-size: 16px;
    padding: 0 0;
    padding-right: 30px;
    letter-spacing: 0.25px;
    background: transparent;
    color: inherit;
}

/* --- Animated Underline --- */
.active-line {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: 1px;
    z-index: 3;
    background-color: var(--primary-color);
    transform: scaleX(0);
    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.field-input:focus ~ .active-line {
    transform: scaleX(1);
}

.input-wrapper.overflow .active-line {
    background-color: var(--error-color);
    transform: scaleX(1);
}

/* --- Clear Button --- */
.clear-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.075, 0.82, 0.165, 1), background-color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.input-wrapper:hover::after {
    background-color: #ccc;
}

.input-wrapper.exists:hover .field-input:not(:focus) ~ .clear-btn,
.input-wrapper.exists .field-input:focus ~ .clear-btn {
    opacity: 1;
}


.input-wrapper.overflow .clear-btn {
    color: var(--error-color);
}

.edit-btn {
    opacity: 0.4;
    transition: opacity 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.edit-btn:hover {
    opacity: 0.8;
}
</style>