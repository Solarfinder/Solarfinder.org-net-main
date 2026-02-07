// Portfolio website transitions and functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all variables
    const sections = document.querySelectorAll('.frame');
    const footer = document.querySelector('footer');
    const navLinks = document.querySelectorAll('.sidebar a[href^="#"]');
    
    // Initialize fade states
    sections.forEach(section => {
        section.classList.add('fade-out');
        section.classList.remove('fade-in');
    });
    
    // Intersection Observer for section transitions
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('fade-in');
                    entry.target.classList.remove('fade-out');
                    
                    // Fade in footer when contact section is visible
                    if (entry.target.id === 'contact' && footer) {
                        setTimeout(() => {
                            footer.classList.add('fade-in');
                            footer.classList.remove('fade-out');
                        }, 200);
                    }
                }, 50);
            } else {
                entry.target.classList.add('fade-out');
                entry.target.classList.remove('fade-in');
            }
        });
    }, {
        root: null,
        rootMargin: '10% 0px 50% 0px',
        threshold: 0.1
    });
    
    // Observe all sections
    sections.forEach(section => observer.observe(section));
    
    // Initialize first visible section
    setTimeout(() => {
        const visibleSection = Array.from(sections).find(section => {
            const rect = section.getBoundingClientRect();
            return rect.top >= 0 && rect.top < window.innerHeight * 0.5;
        });
        
        if (visibleSection) {
            visibleSection.classList.add('fade-in');
            visibleSection.classList.remove('fade-out');
        } else if (sections.length > 0) {
            sections[0].classList.add('fade-in');
            sections[0].classList.remove('fade-out');
        }
    }, 100);
    
    // Navigation click handlers
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                // Fade out current section
                const currentVisible = document.querySelector('.frame.fade-in');
                if (currentVisible && currentVisible !== targetSection) {
                    currentVisible.classList.add('fade-out');
                    currentVisible.classList.remove('fade-in');
                }
                
                // Smooth scroll to target
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Fade in target section
                setTimeout(() => {
                    targetSection.classList.add('fade-in');
                    targetSection.classList.remove('fade-out');
                    
                    // Fade in footer for contact section
                    if (targetId === '#contact' && footer) {
                        setTimeout(() => {
                            footer.classList.add('fade-in');
                            footer.classList.remove('fade-out');
                        }, 200);
                    }
                }, 200);
            }
        });
    });
    
    // Experience & Skills Navigation
    const experienceNavItems = document.querySelectorAll('.experience-nav-item');
    const experienceDetails = document.querySelectorAll('.experience-detail');
    const skillsNavItems = document.querySelectorAll('.skills-nav-item');
    const skillsDetails = document.querySelectorAll('.skills-detail');
    
    // Handle experience navigation
    experienceNavItems.forEach(navItem => {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetId = this.getAttribute('data-target');
            const targetDetail = document.getElementById(targetId);
            
            experienceNavItems.forEach(item => item.classList.remove('active'));
            experienceDetails.forEach(detail => detail.classList.remove('active'));
            
            this.classList.add('active');
            if (targetDetail) {
                targetDetail.classList.add('active');
            }
        });
    });
    
    // Handle skills navigation
    skillsNavItems.forEach(navItem => {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetId = this.getAttribute('data-target');
            const targetDetail = document.getElementById(targetId);
            
            skillsNavItems.forEach(item => item.classList.remove('active'));
            skillsDetails.forEach(detail => detail.classList.remove('active'));
            
            this.classList.add('active');
            if (targetDetail) {
                targetDetail.classList.add('active');
            }
        });
    });
    
    // Sidebar Toggle Functionality
    const toggleBtn = document.querySelector('.toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('i');
            
            if (sidebar.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-right';
                toggleBtn.setAttribute('aria-label', 'Expand sidebar');
            } else {
                icon.className = 'fas fa-bars';
                toggleBtn.setAttribute('aria-label', 'Collapse sidebar');
            }
        });
    }
    
    // PDF Modal Functionality
    const pdfModal = document.getElementById('pdfModal');
    const pdfModalClose = document.getElementById('pdfModalClose');
    const pdfModalOverlay = document.getElementById('pdfModalOverlay');
    const resumeButton = document.querySelector('a[href="assets/kc-res-pdf.pdf"]');
    
    function openPdfModal(e) {
        e.preventDefault();
        pdfModal.classList.add('active');
        pdfModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    
    function closePdfModal() {
        pdfModal.classList.remove('active');
        pdfModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    
    // PDF Modal event listeners
    if (pdfModalClose) pdfModalClose.addEventListener('click', closePdfModal);
    if (pdfModalOverlay) pdfModalOverlay.addEventListener('click', closePdfModal);
    if (resumeButton) resumeButton.addEventListener('click', openPdfModal);
    
    // Collapsible Resume Functionality
    const resumeToggle = document.getElementById('resumeToggle');
    const resumeContent = document.getElementById('resumeContent');
    
    if (resumeToggle && resumeContent) {
        resumeToggle.addEventListener('click', function() {
            const isExpanded = resumeToggle.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                resumeContent.classList.remove('expanded');
                resumeToggle.setAttribute('aria-expanded', 'false');
                resumeToggle.querySelector('span').textContent = 'View Resume';
            } else {
                resumeContent.classList.add('expanded');
                resumeToggle.setAttribute('aria-expanded', 'true');
                resumeToggle.querySelector('span').textContent = 'Hide Resume';
            }
        });
    }
    
    // Mobile Navigation Functionality
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mobileNavLinks = document.querySelectorAll('.sidebar a[href^="#"]');
    
    if (mobileNavToggle && sidebar && sidebarOverlay) {
        function closeMobileNav() {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
            
            mobileNavToggle.setAttribute('aria-expanded', 'false');
            mobileNavToggle.setAttribute('aria-label', 'Open navigation menu');
            sidebarOverlay.setAttribute('aria-hidden', 'true');
        }
        
        // Open mobile navigation
        mobileNavToggle.addEventListener('click', function() {
            sidebar.classList.add('mobile-open');
            sidebarOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            this.setAttribute('aria-expanded', 'true');
            this.setAttribute('aria-label', 'Close navigation menu');
            sidebarOverlay.setAttribute('aria-hidden', 'false');
        });
        
        // Close mobile navigation events
        sidebarOverlay.addEventListener('click', closeMobileNav);
        
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 480) {
                    closeMobileNav();
                }
            });
        });
        
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 480) {
                closeMobileNav();
            }
        });
    }
    
    // Global keyboard events
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close PDF modal if open
            if (pdfModal && pdfModal.classList.contains('active')) {
                closePdfModal();
            }
            
            // Close mobile navigation if open
            if (sidebar && sidebar.classList.contains('mobile-open')) {
                closeMobileNav();
            }
        }
    });
});
