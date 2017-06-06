;; emacs configuration for the markerMapViewer/Dav127 project

;; if you re-load this file, first use (dir-locals-clear-alist-and-cache)

;;------------------------------------------------------------------------------

;; The path of this directory.
;; Used to calculate the git work-tree root dir.
(setq mmv_Dav127
      (replace-regexp-in-string "/resources/$" ""  (file-name-directory load-file-name) )
      )


;;------------------------------------------------------------------------------
;; This configuration is equivalent to ./.dir-locals.el
;;
;; To use .dir-locals.el, mv it to the root of the git work-tree,
;; so it will apply to all .js files in all sub-dirs
;;
;; To use this file : (load-file "$MMV/resources/emacs_config.el")
;;
;; The main difference between these two alternatives approaches is  :
;; The .dir-locals.el is loaded and applied automatically, whereas the file
;; defining dir-locals-set-class-variables has to be loaded explicitly.
;;
;; refn :
;; www.gnu.org/software/emacs/manual/html_node/emacs/Directory-Variables.html
;; www.emacswiki.org/emacs/Js2Mode
;;
;; project-root-directory is the top-level directory of the git work-tree.
;;
(dir-locals-set-class-variables
 'project-root-directory
 `(
   ;; ,(concat mmv_Dav127 "/")
   ("frontend/app"
    . ((nil . (
       ;; don't create lockfiles (.#*) in frontend/app/** because they are not
       ;; ignored by broccoli (see broccoli-sane-watcher, github.com/ember-cli/ember-cli/issues/3908)
       (create-lockfiles . nil)
       ))))
   (js-mode
    . ((c-basic-offset . 2)
       (tab-width . 2)
       (js-indent-level . 2)
       ))
   (js2-mode
    . ((c-basic-offset . 2)
       (indent-tabs-mode . nil)
       (tab-width . 2)
       (js-indent-level . 2)
       (js2-basic-offset . 2)
       (js2-pretty-multiline-declarations . nil)
       ))
   )
 )

;; Define the path project-root-directory.
;;
;; Testing suggests the directory path-name of dir-locals-set-directory-class
;; which the settings apply to is a fixed path string, not a reg-exp.
;; To make this code flexible wrt directory path, the path of the git work-tree
;; is calculated and the settings are configured to apply for that tree.
(dir-locals-set-directory-class
 mmv_Dav127
 'project-root-directory)


;; Undo the effect of the above config additions.
;; Use this before re-loading this file; 
;; (dir-locals-directory-cache accumulates, but 
;; dir-locals-class-alist does not, so doesn't need to be reset before reloading.
;; compilation-error-regexp-alist-alist does not seem to accumulate.)
(defun dir-locals-clear-alist-and-cache ()
  "Reset the variables dir-locals-class-alist and dir-locals-directory-cache to their initial values."
  (interactive nil)

  (setq dir-locals-directory-cache '())
  (setq dir-locals-class-alist '())
  )


;;------------------------------------------------------------------------------

;; refn: https://www.emacswiki.org/emacs/CreatingYourOwnCompileErrorRegexp:
;; "... Usually additions to compilation-error-regexp-alist (etc) can only be made after compilation-mode has loaded. "
(require 'compile)
(add-to-list 'compilation-error-regexp-alist `jslint)
(add-to-list 'compilation-error-regexp-alist-alist '(jslint "^\\(.*?\\): line \\([0-9]+\\), col \\([0-9]+\\), " 1 2 3))

;;------------------------------------------------------------------------------

;; Install web-mode, from melpa.
;;
;; Alternative : manual installation :
;;  http://melpa.org/packages/web-mode-20170225.1206.el
;;  (load-file "~/Downloads/software/editors/emacs/packages/web-mode-20170225.1206.el")
;;
;; See : http://web-mode.org/,  https://github.com/fxbois/web-mode
(defun  install-web-mode
  (interactive nil)
  "Install web-mode, from melpa."

    (progn
      (when (>= emacs-major-version 24)
	(require 'package)
	(add-to-list
	 'package-archives
	 '("melpa" . "http://melpa.org/packages/")	;; or melpa.milkbox.net
	 t)
	(package-initialize))
      ;; then M-x list-packages, find web-mode and click the install link
      )
  )

(setq web-mode-is-installed nil)

(defun Dav127-web-mode-hook ()
  "Hooks for Web mode."
  ;; default is 4
  (setq web-mode-markup-indent-offset 2)
  (setq web-mode-css-indent-offset 2)
  (setq web-mode-code-indent-offset 2)
)
(if web-mode-is-installed
    (progn
      (require 'web-mode)
      (add-hook 'web-mode-hook  'Dav127-web-mode-hook)
      (add-to-list 'auto-mode-alist '("\\.hbs\\'" . web-mode))
      )
  )

;;------------------------------------------------------------------------------
